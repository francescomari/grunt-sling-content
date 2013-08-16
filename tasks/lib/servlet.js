var fs = require("fs");
var path = require("path");
var util = require("util");
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

function appendProperty(form, name, value) {
    if (util.isArray(value)) {
        value.forEach(function (value) {
            form.append(name, value);
        });
    }
    else {
        form.append(name, value);
    }
}

Post.prototype.create = function (path, properties, callback) {

    // Create the request

    var req = request.post(this.getDefaultOptions(path), callback);

    // Add form

    var form = req.form();

    Object.keys(properties).forEach(function (name) {
        appendProperty(form, name, properties[name]);
    });
};

Post.prototype.createFile = function (parent, file, properties, callback) {    
    var self = this;

    // Create the request

    var req = request.post(this.getDefaultOptions(parent), callback);

    // Add form

    var name = path.basename(file);

    var form = req.form();

    form.append("./" + name, fs.createReadStream(file));

    Object.keys(properties).forEach(function (key) {
        appendProperty(form, "./" + name + "/" + key, properties[key]);
    });
};

exports.Post = Post;