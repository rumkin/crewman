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
    # curl http://localhost:$PORT/service
    curl -H 'Authorization: Bearer 549a08ccc76c141e939671e8977dc231a29c9041195ebca71359e59d6d9381f6' \
        http://localhost:$PORT/service
    echo ""

    PORT=$PORT node ws.js 549a08ccc76c141e939671e8977dc231a29c9041195ebca71359e59d6d9381f6
    echo ""
    echo "END"

    # exit
}
