# Service Proxy

This proxy server is made to implement web os components to manipulate operation
system and monitor data. It work like Nginx but for microservices.

## Concept

Just place socket file into `/var/service-proxy/service-name.sock` and get
access to it from web as `http://your-host:4444/service-name/`.

## License

MIT.
