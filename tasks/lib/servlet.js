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

Post.prototype.create = function (path, properties, callback) {

    // Normalize path, remove last slash

    path = removeTrailingSlash(path);

    // Setup options

    var options = {
        url: this.getUrl(path),
        auth: this.getAuth()
    };

    // Create the request

    var req = request.post(options, callback);

    // Add form

    var form = req.form();

    Object.keys(properties).forEach(function (name) {
        form.append(name, properties[name]);
    });
};

Post.prototype.createFile = function (parent, file, properties, callback) {    
    var self = this;

    // Normalize parent, remove last slash

    parent = removeTrailingSlash(parent);

    // Setup options

    var options = {
        url: this.getUrl(parent),
        auth: this.getAuth()
    };    

    // Create the request

    var req = request.post(options, setProperties);

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