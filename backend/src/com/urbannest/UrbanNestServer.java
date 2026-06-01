package com.urbannest;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.io.ObjectInputStream;
import java.io.ObjectOutputStream;
import java.io.Serializable;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class UrbanNestServer {
    private static final Path FRONTEND = Path.of("frontend").toAbsolutePath().normalize();
    private static final Path STORE_FILE = Path.of("data", "urbannest-store.bin").toAbsolutePath().normalize();
    private static final Map<String, Map<String, String>> USERS = new ConcurrentHashMap<>();
    private static final Map<String, String> SESSIONS = new ConcurrentHashMap<>();
    private static final List<Map<String, String>> PGS = new ArrayList<>();
    private static final List<Map<String, String>> JOBS = new ArrayList<>();
    private static final List<Map<String, String>> APPLICATIONS = new ArrayList<>();
    private static final List<Map<String, String>> NOTIFICATIONS = new ArrayList<>();

    public static void main(String[] args) throws Exception {
        loadOrSeed();
        String envPort = System.getenv("PORT");
        int port = args.length > 0 ? Integer.parseInt(args[0]) : envPort == null ? 8080 : Integer.parseInt(envPort);
        HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
        server.createContext("/api/bootstrap", ex -> sendJson(ex, bootstrap()));
        server.createContext("/api/auth/register", ex -> register(ex));
        server.createContext("/api/auth/login", ex -> login(ex));
        server.createContext("/api/pgs", ex -> listOrCreate(ex, PGS, "PG listing"));
        server.createContext("/api/jobs", ex -> listOrCreate(ex, JOBS, "job listing"));
        server.createContext("/api/applications", ex -> apply(ex));
        server.createContext("/api/referrals", ex -> referral(ex));
        server.createContext("/api/resume", ex -> resume(ex));
        server.createContext("/api/health", ex -> sendJson(ex, "{\"status\":\"ok\"}"));
        server.createContext("/", UrbanNestServer::staticFile);
        server.setExecutor(null);
        server.start();
        System.out.println("UrbanNest running at http://localhost:" + port);
    }

    private static void register(HttpExchange ex) throws IOException {
        if (!"POST".equals(ex.getRequestMethod())) {
            sendJson(ex, "{\"error\":\"POST required\"}", 405);
            return;
        }
        Map<String, String> body = parseJson(readBody(ex));
        String email = body.getOrDefault("email", "").toLowerCase();
        if (email.isBlank() || USERS.containsKey(email)) {
            sendJson(ex, "{\"error\":\"Email is required or already registered\"}", 400);
            return;
        }
        body.put("id", UUID.randomUUID().toString());
        body.put("createdAt", Instant.now().toString());
        body.put("points", "125");
        body.put("referralCode", "UN-" + Math.abs(email.hashCode()));
        USERS.put(email, body);
        createNotification(email, "Welcome to UrbanNest", "Your " + body.getOrDefault("role", "student") + " workspace is ready.");
        saveStore();
        sendJson(ex, sessionPayload(body));
    }

    private static void login(HttpExchange ex) throws IOException {
        Map<String, String> body = parseJson(readBody(ex));
        Map<String, String> user = USERS.get(body.getOrDefault("email", "").toLowerCase());
        if (user == null || !user.getOrDefault("password", "").equals(body.getOrDefault("password", ""))) {
            sendJson(ex, "{\"error\":\"Invalid email or password\"}", 401);
            return;
        }
        sendJson(ex, sessionPayload(user));
    }

    private static void listOrCreate(HttpExchange ex, List<Map<String, String>> rows, String label) throws IOException {
        if ("GET".equals(ex.getRequestMethod())) {
            sendJson(ex, toJson(rows));
            return;
        }
        Map<String, String> item = parseJson(readBody(ex));
        item.putIfAbsent("id", UUID.randomUUID().toString());
        item.putIfAbsent("status", "Pending Approval");
        item.putIfAbsent("rating", "4.6");
        item.putIfAbsent("distance", "2.4 km");
        rows.add(0, item);
        createBroadcast("New " + label, item.getOrDefault("title", item.getOrDefault("name", "A listing")) + " was posted near students.");
        saveStore();
        sendJson(ex, toJson(item), 201);
    }

    private static void apply(HttpExchange ex) throws IOException {
        Map<String, String> body = parseJson(readBody(ex));
        body.put("id", UUID.randomUUID().toString());
        body.put("status", "Submitted");
        body.put("createdAt", Instant.now().toString());
        APPLICATIONS.add(0, body);
        createNotification(body.getOrDefault("email", "student@urbannest.local"), "Application submitted", "Track updates from your dashboard.");
        saveStore();
        sendJson(ex, toJson(body), 201);
    }

    private static void referral(HttpExchange ex) throws IOException {
        Map<String, String> body = parseJson(readBody(ex));
        String email = body.getOrDefault("email", "student@urbannest.local").toLowerCase();
        Map<String, String> user = USERS.getOrDefault(email, new LinkedHashMap<>());
        String code = user.getOrDefault("referralCode", "UN-DEMO-2026");
        sendJson(ex, "{\"code\":\"" + escape(code) + "\",\"total\":\"12\",\"earnings\":\"2400\",\"history\":[\"Aditi joined\",\"Rohan booked a PG\",\"Neha applied for a job\"]}");
    }

    private static void resume(HttpExchange ex) throws IOException {
        Map<String, String> b = parseJson(readBody(ex));
        String html = "<section><h2>" + escape(b.getOrDefault("name", "Student")) + "</h2><p>" +
                escape(b.getOrDefault("summary", "Student resume")) + "</p><h3>Skills</h3><p>" +
                escape(b.getOrDefault("skills", "Communication, teamwork")) + "</p><h3>Projects</h3><p>" +
                escape(b.getOrDefault("projects", "UrbanNest profile")) + "</p></section>";
        sendJson(ex, "{\"preview\":\"" + escape(html) + "\"}");
    }

    private static String sessionPayload(Map<String, String> user) {
        String token = UUID.randomUUID().toString();
        SESSIONS.put(token, user.get("email"));
        return "{\"token\":\"" + token + "\",\"user\":" + toJson(user) + "}";
    }

    private static String bootstrap() {
        Map<String, Object> root = new LinkedHashMap<>();
        root.put("pgs", PGS);
        root.put("jobs", JOBS);
        root.put("applications", APPLICATIONS);
        root.put("notifications", NOTIFICATIONS);
        root.put("stats", Map.of("users", USERS.size(), "pgs", PGS.size(), "jobs", JOBS.size(), "applications", APPLICATIONS.size(), "growth", "28%"));
        return toJson(root);
    }

    private static void loadOrSeed() {
        if (Files.exists(STORE_FILE)) {
            try (ObjectInputStream in = new ObjectInputStream(Files.newInputStream(STORE_FILE))) {
                Store store = (Store) in.readObject();
                USERS.putAll(store.users);
                PGS.addAll(store.pgs);
                JOBS.addAll(store.jobs);
                APPLICATIONS.addAll(store.applications);
                NOTIFICATIONS.addAll(store.notifications);
                return;
            } catch (Exception ignored) {
                USERS.clear();
                PGS.clear();
                JOBS.clear();
                APPLICATIONS.clear();
                NOTIFICATIONS.clear();
            }
        }
        seed();
        saveStore();
    }

    private static synchronized void saveStore() {
        try {
            Files.createDirectories(STORE_FILE.getParent());
            Store store = new Store();
            store.users.putAll(USERS);
            store.pgs.addAll(PGS);
            store.jobs.addAll(JOBS);
            store.applications.addAll(APPLICATIONS);
            store.notifications.addAll(NOTIFICATIONS);
            try (ObjectOutputStream out = new ObjectOutputStream(Files.newOutputStream(STORE_FILE))) {
                out.writeObject(store);
            }
        } catch (IOException e) {
            System.err.println("Could not save UrbanNest data: " + e.getMessage());
        }
    }

    private static void staticFile(HttpExchange ex) throws IOException {
        String path = URLDecoder.decode(ex.getRequestURI().getPath(), StandardCharsets.UTF_8);
        if (path.equals("/")) path = "/index.html";
        Path file = FRONTEND.resolve(path.substring(1)).normalize();
        if (!file.startsWith(FRONTEND) || !Files.exists(file) || Files.isDirectory(file)) {
            file = FRONTEND.resolve("index.html");
        }
        byte[] bytes = Files.readAllBytes(file);
        ex.getResponseHeaders().set("Content-Type", contentType(file));
        ex.getResponseHeaders().set("Cache-Control", "no-store");
        ex.sendResponseHeaders(200, bytes.length);
        try (OutputStream os = ex.getResponseBody()) {
            os.write(bytes);
        }
    }

    private static void seed() {
        seedUser("student@urbannest.test", "Student", "student");
        seedUser("owner@urbannest.test", "PG Owner", "owner");
        seedUser("recruiter@urbannest.test", "Recruiter", "recruiter");
        seedUser("admin@urbannest.test", "Admin", "admin");
        PGS.add(row("id", "pg-1", "name", "Skyline Student Homes", "city", "Bengaluru", "area", "Koramangala", "rent", "9500", "gender", "Unisex", "amenities", "Wi-Fi, Meals, Laundry, CCTV", "rating", "4.8", "distance", "1.2 km", "lat", "12.9352", "lng", "77.6245", "image", "https://images.unsplash.com/photo-1554995207-c18c203602cb?auto=format&fit=crop&w=900&q=80", "owner", "Meera Homes", "status", "Approved"));
        PGS.add(row("id", "pg-2", "name", "Metro Nest Girls PG", "city", "Pune", "area", "Viman Nagar", "rent", "8200", "gender", "Female", "amenities", "Meals, Study lounge, Housekeeping", "rating", "4.7", "distance", "2.0 km", "lat", "18.5679", "lng", "73.9143", "image", "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=900&q=80", "owner", "Anika Stay Co", "status", "Approved"));
        JOBS.add(row("id", "job-1", "title", "Cafe Shift Associate", "company", "Bean Street", "category", "Retail", "salary", "14000", "type", "Part-Time", "hours", "5 PM - 10 PM", "location", "Koramangala", "distance", "900 m", "rating", "4.5", "logo", "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=400&q=80", "status", "Approved"));
        JOBS.add(row("id", "job-2", "title", "Campus Content Intern", "company", "BrightLoop", "category", "Marketing", "salary", "9000", "type", "Part-Time", "hours", "Flexible", "location", "Viman Nagar", "distance", "1.8 km", "rating", "4.6", "logo", "https://images.unsplash.com/photo-1559136555-9303baea8ebd?auto=format&fit=crop&w=400&q=80", "status", "Approved"));
        createBroadcast("Nearby match found", "2 PGs and 2 part-time jobs match your location and skills.");
    }

    private static void seedUser(String email, String name, String role) {
        USERS.put(email, row("id", UUID.randomUUID().toString(), "email", email, "password", "demo123", "name", name, "role", role, "phone", "9999999999", "location", "Bengaluru", "college", "Urban College", "points", "320", "referralCode", "UN-" + role.toUpperCase() + "-2026"));
    }

    private static Map<String, String> row(String... kv) {
        Map<String, String> map = new LinkedHashMap<>();
        for (int i = 0; i < kv.length - 1; i += 2) map.put(kv[i], kv[i + 1]);
        return map;
    }

    private static String readBody(HttpExchange ex) throws IOException {
        return new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
    }

    private static Map<String, String> parseJson(String json) {
        Map<String, String> map = new LinkedHashMap<>();
        Matcher m = Pattern.compile("\"([^\"]+)\"\\s*:\\s*\"((?:\\\\.|[^\"])*)\"").matcher(json == null ? "" : json);
        while (m.find()) map.put(m.group(1), unescapeJson(m.group(2)));
        return map;
    }

    private static String unescapeJson(String value) {
        return value.replace("\\\"", "\"").replace("\\\\", "\\").replace("\\n", "\n");
    }

    private static void createNotification(String email, String title, String message) {
        NOTIFICATIONS.add(0, row("id", UUID.randomUUID().toString(), "email", email, "title", title, "message", message, "time", "now"));
    }

    private static void createBroadcast(String title, String message) {
        NOTIFICATIONS.add(0, row("id", UUID.randomUUID().toString(), "email", "all", "title", title, "message", message, "time", "now"));
    }

    private static String toJson(Object obj) {
        if (obj instanceof Map<?, ?> map) {
            List<String> parts = new ArrayList<>();
            for (Map.Entry<?, ?> e : map.entrySet()) parts.add("\"" + escape(String.valueOf(e.getKey())) + "\":" + toJson(e.getValue()));
            return "{" + String.join(",", parts) + "}";
        }
        if (obj instanceof List<?> list) {
            List<String> parts = new ArrayList<>();
            for (Object item : list) parts.add(toJson(item));
            return "[" + String.join(",", parts) + "]";
        }
        if (obj instanceof Number || obj instanceof Boolean) return String.valueOf(obj);
        return "\"" + escape(String.valueOf(obj)) + "\"";
    }

    private static String escape(String value) {
        return value == null ? "" : value.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "");
    }

    private static void sendJson(HttpExchange ex, String body) throws IOException {
        sendJson(ex, body, 200);
    }

    private static void sendJson(HttpExchange ex, String body, int status) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        ex.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
        ex.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
        ex.getResponseHeaders().set("Cache-Control", "no-store");
        ex.sendResponseHeaders(status, bytes.length);
        try (OutputStream os = ex.getResponseBody()) {
            os.write(bytes);
        }
    }

    private static String contentType(Path file) {
        String name = file.getFileName().toString();
        if (name.endsWith(".css")) return "text/css; charset=utf-8";
        if (name.endsWith(".js")) return "application/javascript; charset=utf-8";
        if (name.endsWith(".svg")) return "image/svg+xml";
        return "text/html; charset=utf-8";
    }

    private static class Store implements Serializable {
        Map<String, Map<String, String>> users = new LinkedHashMap<>();
        List<Map<String, String>> pgs = new ArrayList<>();
        List<Map<String, String>> jobs = new ArrayList<>();
        List<Map<String, String>> applications = new ArrayList<>();
        List<Map<String, String>> notifications = new ArrayList<>();
    }
}
