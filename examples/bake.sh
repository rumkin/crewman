task:build() {
    cd ..;
    [ -d build ] && rm -rf build;
    cp -r src build
}

kill_existed() {
    local PID=$1

    if [ -e /proc/$PID ]
    then
        kill -s 9 $PID
    fi
}

task:spawn() {
    local PORT=${1:-3333}

    PORT=$PORT node master.js &
    SERVER_PID=$!

    PORT=/tmp/service.sock node service.js &
    SERVICE_PID=$!

    onFinish() {
        kill_existed $SERVER_PID
        kill_existed $SERVICE_PID
    }

    trap onFinish EXIT

    sleep 1

    echo "START"
    echo ""
    curl http://localhost:$PORT/service
    echo ""

    PORT=$PORT node ws.js
    echo ""
    echo "END"

    # exit
}
