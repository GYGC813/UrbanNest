$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot
New-Item -ItemType Directory -Force -Path "backend\out" | Out-Null
javac -encoding UTF-8 -d "backend\out" "backend\src\com\urbannest\UrbanNestServer.java"
$port = if ($args.Count -gt 0) { $args[0] } else { "8091" }
java -cp "backend\out" com.urbannest.UrbanNestServer $port
