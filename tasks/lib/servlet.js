var fs = require("fs");
var path = require("path");
var request = require("request");

function removeTrailingSlash(path) {
    if (path === "/") {
        return path;
    }

    if (path.slice(-1) === "/") {
        return path.slice(0, -1);
    }

    return path;
}

function Post(options) {
    this.host = options.host;
    this.port = options.port;
    this.user = options.user;
    this.pass = options.pass;
}

Post.prototype.getUrl = function (path) {
    return {
        protocol: "http:",
        host: this.host,
        port: this.port,
        pathname: path
    };
};

Post.prototype.getAuth = function () {
    return {
        user: this.user,
        pass: this.pass
    };
};

Post.prototype.getDefaultOptions = function (path) {
    return {
        url: this.getUrl(removeTrailingSlash(path)),
        headers: { "Accept": "application/json" },
        auth: this.getAuth()
    };
};

Post.prototype.create = function (path, properties, callback) {

    // Create the request

    var req = request.post(this.getDefaultOptions(path), callback);

    // Add form

    var form = req.form();

    Object.keys(properties).forEach(function (name) {
        form.append(name, properties[name]);
    });
};

Post.prototype.createFile = function (parent, file, properties, callback) {    
    var self = this;

    // Create the request

    var req = request.post(this.getDefaultOptions(parent), setProperties);

    // Add form

    var form = req.form();

    form.append("*", fs.createReadStream(file));

    function setProperties(err) {
        if (err) {
            return callback(err);
        }

        self.create(parent + "/" + path.basename(file), properties, callback);
    }
};

exports.Post = Post;