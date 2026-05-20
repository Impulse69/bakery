$BRAINSTORM_DIR = "C:\Users\User\bakery\.superpowers\brainstorm\session-gemini"
$BRAINSTORM_HOST = "127.0.0.1"
$BRAINSTORM_URL_HOST = "localhost"
$BRAINSTORM_OWNER_PID = $pid

if (!(Test-Path "$BRAINSTORM_DIR\content")) {
    New-Item -ItemType Directory -Path "$BRAINSTORM_DIR\content" -Force
}
if (!(Test-Path "$BRAINSTORM_DIR\state")) {
    New-Item -ItemType Directory -Path "$BRAINSTORM_DIR\state" -Force
}

$env:BRAINSTORM_DIR = $BRAINSTORM_DIR
$env:BRAINSTORM_HOST = $BRAINSTORM_HOST
$env:BRAINSTORM_URL_HOST = $BRAINSTORM_URL_HOST
$env:BRAINSTORM_OWNER_PID = $BRAINSTORM_OWNER_PID

node "C:\Users\User\.gemini\extensions\superpowers\skills\brainstorming\scripts\server.cjs"
