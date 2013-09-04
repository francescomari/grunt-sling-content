var fs = require("fs");
var path = require("path");
var util = require("util");
var request = require("request");

/**
 * Remove the trailing slash from a URL path.
 * @param  {String} path The path to be normalized.
 * @return {String} The normalized path.
 */
function removeTrailingSlash(path) {
    if (path === "/") {
        return path;
    }

    if (path.slice(-1) === "/") {
        return path.slice(0, -1);
    }

    return path;
}

/**
 * Normalize properties to be sent to Sling via the POST Servlet. In
 * particular, for each array property, make sure that a "@TypeHint" exists to
 * create a JCR multi-value property on the server.
 * @param  {Object} properties Properties to be normalized.
 * @return {Object} Normalized properties.
 */
function normalizeProperties(properties) {
    var arrays = Object.keys(properties).filter(function (name) {
        return util.isArray(properties[name]);
    });

    var typeHints = arrays.map(function (name) {
        return name + "@TypeHint";
    });

    typeHints.forEach(function (typeHint) {
        if (!properties[typeHint]) {
            properties[typeHint] = "String[]";
        }
    });

    return properties;
}

/**
 * Append a property to the form. Ensures that property values and multi-value
 * properties are converted in the correct way.
 * @param  {Object} form Form to append the properties to.
 * @param  {String} name Name of the property.
 * @param  {Object} value Value of the property.
 * @param  {Object} [options] property for form element is optional
 */
function appendProperty(form, name, value, options) {
    if (util.isArray(value)) {
        value.forEach(function (value) {
            form.append(name, value);
        });
    }
    else if (typeof value === "boolean") {
        form.append(name, value ? "true" : "false");
    }
    else {
        form.append(name, value, options);
    }
}

/**
 * Creates a wrapper around the Sling POST Servlet.
 * @param {Object} options Options containing the host and port of the Sling
 *     instance and the user name and password to use to post content.
 */
function Post(options) {
    this.host = options.host;
    this.port = options.port;
    this.user = options.user;
    this.pass = options.pass;
}

exports.Post = Post;

/**
 * Return the URL for a given path. The URL will have a correct protocol, host
 * and port.
 * @param  {String} path Path to be added to the URL.
 * @return {String} A full URL targeting the given path on the configured
 *     Sling instance.
 */
Post.prototype.getUrl = function (path) {
    return "http://" + this.host + ":" + this.port + path;
};

/**
 * Create an authorization object to authorize the request.
 * @return {Object} Authorization object.
 */
Post.prototype.getAuth = function () {
    return {
        user: this.user,
        pass: this.pass
    };
};

/**
 * Create default options to add to each reqest. Default options include the
 * URL to post to, "Accept" header to always request a JSON response, proxy
 * configuration and authorization informtion.
 * @param  {String} path Path to send the request to.
 * @return {Object} Options to be added to each request.
 */
Post.prototype.getDefaultOptions = function (path) {
    return {
        url: this.getUrl(removeTrailingSlash(path)),
        headers: { "Accept": "application/json" },
        proxy: process.env.http_proxy,
        auth: this.getAuth()
    };
};

/**
 * Create a node in the Sling instance.
 * @param  {String}   path Path of the node to create.
 * @param  {Object}   properties Properties of the node.
 * @param  {Function} callback Callback to be invoked when the creation is
 *     complete.
 */
Post.prototype.create = function (path, properties, callback) {

    // Create the request

    var req = request.post(this.getDefaultOptions(path), callback);

    // Add request properties

    properties = normalizeProperties(properties);

    // Add form only if fields must be submitted

    var names = Object.keys(properties);

    if (names.length === 0) {
        return;
    }

    var form = req.form();

    names.forEach(function (name) {
        appendProperty(form, name, properties[name]);
    });

    req.setHeader('Content-Length', form.getLengthSync(false));
};

/**
 * Create a file in the Sling instance.
 * @param  {String}   parent Path of the parent node of the newly created
 *     file.
 * @param  {String}   file Path to a file on the local filesystem.
 * @param  {Object}   properties Properties to add to the file node.
 * @param  {Function} callback Callback to be invoked when the creation is
 *     complete.
 */
Post.prototype.createFile = function (parent, file, properties, callback) {    
    var self = this;

    // Create the request

    var req = request.post(this.getDefaultOptions(parent), callback);

    // Add form

    var form = req.form();

    // Add file content

    var name = path.basename(file);

    appendProperty(form, "./" + name, fs.createReadStream(file), {
      knownLength:fs.statSync(file).size
    });

    // Add request properties

    properties = normalizeProperties(properties);

    Object.keys(properties).forEach(function (key) {
        appendProperty(form, "./" + name + "/" + key, properties[key]);
    });
    req.setHeader('Content-Length', form.getLengthSync(false));
};

/**
 * Import content into the Sling instance.
 * @param  {String}   parent Path of the parent node of the subtree to import.
 * @param  {String}   name Name of the node to create, represented by the
 *     content file.
 * @param  {String}   file Path to the content file.
 * @param  {String}   type Type of the import to perform.
 * @param  {Object}   properties Additional properties driving the import
 *     operation.
 * @param  {Function} callback Callback to invoke when the import is complete.
 */
Post.prototype.importContent = function (parent, name, file, type, properties, callback) {
    var self = this;

    // Create the request

    var req = request.post(this.getDefaultOptions(parent), callback);

    // Add form

    var form = req.form();

    appendProperty(form, ":operation", "import");

    // Add file content

    appendProperty(form, ":name", name);
    appendProperty(form, ":contentFile", fs.createReadStream(file));
    appendProperty(form, ":contentType", type);

    // Add optional properties

    if (properties.checkin) {
        appendProperty(form, ":checkin", properties.checkin);
    }

    if (properties.autoCheckout) {
        appendProperty(form, ":autoCheckout", properties.autoCheckout);
    }

    if (properties.replace) {
        appendProperty(form, ":replace", properties.replace);
    }

    if (properties.replaceProperties) {
        appendProperty(form, ":replaceProperties", properties.replaceProperties);
    }
};