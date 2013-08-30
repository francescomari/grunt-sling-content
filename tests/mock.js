var http = require("http");
var express = require("express");

function Requests(requests) {
    this.requests = requests;
}

Requests.prototype.length = function() {
    return this.requests.length;
};

Requests.prototype.withUser = function(user) {
    var requests = this.requests.filter(function (request) {
        return request.user === user;
    });

    return new Requests(requests);
};

Requests.prototype.withMethod = function(method) {
    var requests = this.requests.filter(function (request) {
        return request.method === method.toUpperCase();
    });

    return new Requests(requests);
};

Requests.prototype.withPath = function(path) {
    var requests = this.requests.filter(function (request) {
        return request.path === path;
    });

    return new Requests(requests);
};

Requests.prototype.withField = function(name, value) {
    var requests = this.requests.filter(function (request) {
        if (request.body === undefined) {
            return false;
        }

        if (request.body[name] === undefined) {
            return false;
        }

        if (value === undefined) {
            return true;
        }

        return request.body[name].toString() === value.toString();
    });

    return new Requests(requests);
};

Requests.prototype.withFile = function(name) {
    var requests = this.requests.filter(function (request) {
        if (request.files === undefined) {
            return false;
        }

        return request.files[name] !== undefined;
    });

    return new Requests(requests);
};

Requests.prototype.notEmpty = function() {
    return this.requests.length > 0;
};

exports.server = function (port, sendCallback, verifyCallback) {
    var self = this;

    var requests = [];

    var app = express();

    app.use(express.basicAuth(function (user, pass) {
        return true;
    }));

    app.use(express.bodyParser());

    app.all("*", function (req, res) {
        requests.push(req);
        res.send(200);
    });

    var server = http.createServer(app);

    var doneCallback = function () {
        server.close();
    };

    server.on("listening", function () {
        sendCallback(doneCallback);
    });

    server.on("close", function () {
        verifyCallback(new Requests(requests));
    });

    server.listen(port);
};