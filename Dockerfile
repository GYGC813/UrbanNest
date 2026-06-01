FROM eclipse-temurin:21-jdk
WORKDIR /app
COPY . .
RUN mkdir -p backend/out && javac -encoding UTF-8 -d backend/out backend/src/com/urbannest/UrbanNestServer.java
EXPOSE 8080
CMD ["java", "-cp", "backend/out", "com.urbannest.UrbanNestServer"]
