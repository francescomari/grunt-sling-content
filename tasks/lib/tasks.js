var fs = require("fs");
var path = require("path");
var util = require("util");
var async = require("async");

var servlet = require("./servlet");

/**
 * Concatenate two resource paths. Ensure that path separators are correctly
 * handled.
 * @param {String} parent The path of the parent resource.
 * @param {String} node The name of the node to concatenate.
 * @return {String} A new path resulting from the concatenation of parent and
 *     node.
 */
function concatResource(parent, node) {
    if (parent.slice(-1) === "/") {
        return parent + node;
    }
    else {
        return parent + "/" + node;
    }
}

/**
 * Takes care of posting file recuresively in a directory.
 * @param {Object} task The task object, loose requirements on its APIs are needed.
 * @param {String} root Path of the directory.
 * @param {String} resource Path of the resource whom the directory wil be mapped to.
 */
function DirectoryPoster(task, root, resource) {
    this.task = task;
    this.directory = root;
    this.resource = resource;
}

exports.DirectoryPoster = DirectoryPoster;

/**
 * Creates an instance of the POST Servlet wrapper, correctly configured. The
 * instance is cached, multiple invocations of this method will return the
 * same instance.
 * @return {Object} An instance of the POST Servlet wrapper.
 */
DirectoryPoster.prototype.getServlet = function () {
    var self = this;

    if (self.servlet) {
        return self.servlet;
    }

    self.servlet = new servlet.Post(self.task.getOptions());

    return self.servlet;
};

/**
 * Reads the children of the current directory. Returns an array of file
 * names. The returned array is cached, multiple invocations of this method
 * will return the same array.
 * @return {Array} Array of names for children of the current directory.
 */
DirectoryPoster.prototype.getChildren = function() {
    var self = this;

    if (self.children) {
        return self.children;
    }

    self.children = fs.readdirSync(self.directory);

    return self.children;
};

/**
 * Reads the children files of the current directory. Returns an array of file
 * names. The returned array is cached, multiple invocations of this method
 * will return the same array.
 * @return {Array} Array of names for children files of the current directory.
 */
DirectoryPoster.prototype.getFiles = function() {
    var self = this;

    if (self.files) {
        return self.files;
    }

    var isFile = self.task.grunt.file.isFile;

    function filesOnly(child) {
        return isFile(self.directory, child) && path.extname(child) !== ".json";
    }

    self.files = self.getChildren().filter(filesOnly);

    return self.files;
};

/**
 * Reads the children directories of the current directory. Returns an array
 * of directory names. The returned array is cached, multiple invocations of
 * this method will return the same array.
 * @return {Array} Array of names for children directories of the current
 *     directory.
 */
DirectoryPoster.prototype.getDirectories = function() {
    var self = this;

    if (self.directories) {
        return self.directories;
    }

    var isDir = self.task.grunt.file.isDir;

    function directoriesOnly(child) {
        return isDir(self.directory, child);
    }

    self.directories = self.getChildren().filter(directoriesOnly);

    return self.directories;
};

/**
 * Reads the children descriptor files of the current directory. Returns an
 * array of directory names. The returned array is cached, multiple
 * invocations of this method will return the same array.
 * @return {Array} Array of names for children descriptor files of the current
 *     directory.
 */
DirectoryPoster.prototype.getDescriptors = function() {
    var self = this;

    if (self.descriptors) {
        return self.descriptors;
    }

    var isFile = self.task.grunt.file.isFile;

    self.descriptors = self.getChildren().filter(function (child) {
        return isFile(self.directory, child) && path.extname(child) === ".json";
    });

    return self.descriptors;
};

/**
 * Return a map of descriptor files. The map will have as keys the base name
 * of the descriptor file (without the ".json" extension), and as value the
 * content of the corresponding descriptor file, already parsed.
 * @return {Object} Map of descriptor names to descriptor contents.
 */
DirectoryPoster.prototype.getDescriptorMap = function() {
    var self = this;

    if (self.descriptorMap) {
        return self.descriptorMap;
    }

    var readJSON = self.task.grunt.file.readJSON;

    function toDescriptorMap(map, descriptor) {
        var base = path.basename(descriptor, ".json");

        var json = readJSON(path.join(self.directory, descriptor));

        map[base] = json;

        return map;
    }

    self.descriptorMap = self.getDescriptors().reduce(toDescriptorMap, {});

    return self.descriptorMap;
};

/**
 * Return the descriptor properties for a file of a given name. The properties
 * are read from the corresponding descriptors, if it exists. Initial values,
 * for properties can be provided to the method. Initial values are used if
 * the descriptor files doesn't contain those properties.
 * @param  {String} name Name of the file.
 * @param  {Object} initial Initial properties.
 * @return {Object} Descriptor properties for the file with the given name,
 *     optionally merged with initial properties.
 */
DirectoryPoster.prototype.propertiesFor = function(name, initial) {
    var self = this;

    var base = path.basename(name, path.extname(name));

    var descriptorMap = self.getDescriptorMap();

    var descriptor = descriptorMap[base] || {};

    var result = initial || {};

    Object.keys(descriptor).forEach(function (name) {
        result[name] = descriptor[name];
    });

    return result;
};

/**
 * Decorate the callback which will be passed to the POST Servlet. The
 * decorated callback will parse the JSON response of the POST Servlet and
 * will print a warning if an error occurs.
 * @param  {Function} callback Original callback.
 * @return {Function} A function wrapping the original callback and adding
 *     functionalities.
 */
DirectoryPoster.prototype.decorateCallback = function(callback) {
    return function (err, response, body) {
        if (err) {
            return callback(err);
        }

        var b = JSON.parse(body);

        if (response.statusCode < 200 || response.statusCode >= 300) {
            self.task.grunt.warn(util.format("Error writing %s: %s: %s.", b.path, b.error.class, b.error.message));
        }

        callback(err, response, body);
    };
};

/**
 * Creates task functions to post the files contained in the current
 * directory.
 * @return {Array} Array of task functions.
 */
DirectoryPoster.prototype.getFileTasks = function() {
    var self = this;

    function toFileTasks(file) {
        return function (done) {
            self.task.grunt.log.writeln("File: " + path.join(self.directory, file));

            var parentResource = self.resource;
            var filePath = path.join(self.directory, file);
            var properties = self.propertiesFor(file);
            var callback = self.decorateCallback(done);

            self.getServlet().createFile(parentResource, filePath, properties, callback);
        };
    }

    return self.getFiles().map(toFileTasks);
};

/**
 * Creates task functions to post the directories contained in the current
 * directory.
 * @return {Array} Array of task functions.
 */
DirectoryPoster.prototype.getDirectoryTasks = function() {
    var self = this;

    function toDirectoryTask(directory) {
        return function (done) {
            self.task.grunt.log.writeln("Dir : " + path.join(self.directory, directory));

            var resource = concatResource(self.resource, directory);
            var callback = self.decorateCallback(done);

            var properties = self.propertiesFor(directory, {
                "jcr:primaryType": "sling:Folder"
            });

            self.getServlet().create(resource, properties, callback);
        };
    }

    return self.getDirectories().map(toDirectoryTask);
};

/**
 * Returns the names of the descriptors which are not used to describe other
 * files or directories in the current directory.
 * @return {Array} Array of descriptor names.
 */
DirectoryPoster.prototype.getUnusedDescriptorNames = function() {
    var self = this;

    function unusedDescriptor(name) {
        var usedForDirectories = self.getDirectories().some(function (directory) {
            return directory === name;
        });

        var usedForFiles = self.getFiles().some(function (file) {
            return path.basename(file, path.extname(file)) === name;
        });

        return !usedForFiles && !usedForDirectories;
    }

    return Object.keys(self.getDescriptorMap()).filter(unusedDescriptor);
};

/**
 * Creates task functions to post node descriptors contained in the current
 * directory.
 * @return {Array} Array of task functions.
 */
DirectoryPoster.prototype.getNodeTasks = function() {
    var self = this;

    function toNodeTask(name) {
        return function (done) {
            var jsonName = path.join(self.directory, name + ".json");

            self.task.grunt.log.writeln("Node: " + jsonName);

            var resource = concatResource(self.resource, name);
            var properties = self.propertiesFor(jsonName);
            var callback = self.decorateCallback(done);

            self.getServlet().create(resource, properties, callback);
        };
    }

    return self.getUnusedDescriptorNames().map(toNodeTask);
};

/**
 * Creates task functions which will be used to recurse in the directories
 * contained in the current directory.
 * @return {Array} Array of task functions.
 */
DirectoryPoster.prototype.getRecursionTasks = function() {
    var self = this;

    function toRecursionTask(directory) {
        return function (done) {
            var newRoot = path.join(self.directory, directory);
            var newResource = concatResource(self.resource, directory);
            
            var poster = new DirectoryPoster(self.task, newRoot, newResource);
            
            poster.post(done);
        };
    }

    return self.getDirectories().map(toRecursionTask);
};

/**
 * Submit the content of the current directory to the POST Servlet. After the
 * required content for the current directory has been created, recurse into
 * the directories in the current directory and repeat the process.
 * @param  {Function} done Callback which will be invoked when the submission
 *     of data is finished.
 */
DirectoryPoster.prototype.post = function(done) {
    var self = this;

    var fileTasks = self.getFileTasks();
    var directoryTasks = self.getDirectoryTasks();
    var nodeTasks = self.getNodeTasks();

    var tasks = fileTasks.concat(nodeTasks).concat(directoryTasks);

    async.parallel(tasks, function (err) {
        if (err) {
            return done(err);
        }

        var tasks = self.getRecursionTasks();

        async.parallel(tasks, done);
    });
};

/**
 * Task to subnit content of directories to the Sling POST Servlet.
 * @param {Object} grunt The Grunt main object.
 * @param {Object} task The task object ("this" inside the task function).
 */
function SlingPost(grunt, task) {
    this.grunt = grunt;
    this.task = task;
}

exports.SlingPost = SlingPost;

/**
 * Execute the task.
 */
SlingPost.prototype.run = function() {
    var self = this;

    self.printOptions();    
    self.validate();
    self.postDirectories(self.task.async());
};

/**
 * Return the option object, with default values used if none is provided from
 * the user.
 * @return {Object} Option object.
 */
SlingPost.prototype.getOptions = function() {
    if (this.options) {
        return this.options;
    }

    this.options = this.task.options({
        host: "localhost",
        port: 8080,
        user: "admin",
        pass: "admin"
    });

    return this.options;
};

/**
 * Print the options to the Grunt logger.
 */
SlingPost.prototype.printOptions = function () {
    var options = this.getOptions();
    var writeln = this.grunt.verbose.writeln;

    writeln("Host: " + options.host);
    writeln("Port: " + options.port);
    writeln("User: " + options.user);
};

/**
 * Validate the input files provided by the user.
 */
SlingPost.prototype.validate = function() {
    var self = this;

    self.task.files.forEach(function (group) {
        group.src.forEach(function (root) {
            if (self.grunt.file.exists(root) === false) {
                self.grunt.fatal(util.format("The directory %s does not exist.", root));
            }

            if (self.grunt.file.isDir(root) === false) {
                self.grunt.fatal(util.format("The path %s is not a directory.", root));
            }
        });
    });
};

/**
 * Recursively submit the content of the directories passed to the task to the
 * Sling POST Servlet.
 * @param  {Function} done Callback which will be invoked when every input
 *     directory is submitted to the Sling POST Servlet.
 */
SlingPost.prototype.postDirectories = function(done) {
    var self = this;

    var tasks = [];

    self.task.files.forEach(function (group) {
        group.src.forEach(function (directory) {
            tasks.push(function (done) {
                new DirectoryPoster(self, directory, group.orig.dest).post(done);
            });
        });
    });

    async.parallel(tasks, done);
};

function SlingImport(grunt, task) {
    this.grunt = grunt;
    this.task = task;
}

exports.SlingImport = SlingImport;

SlingImport.prototype.run = function() {
    var grunt = this.grunt;

    function printOptions(grunt, options) {
        grunt.verbose.writeln("Host: " + options.host);
        grunt.verbose.writeln("Port: " + options.port);
        grunt.verbose.writeln("User: " + options.user);
        grunt.verbose.writeln("Checkin: " + options.checkin);
        grunt.verbose.writeln("Auto-checkout: " + options.checkin);
        grunt.verbose.writeln("Replace: " + options.checkin);
        grunt.verbose.writeln("Replace properties: " + options.checkin);
    }

    function validateImportTypes(grunt, files) {
        files.forEach(function (group) {
            group.src.forEach(function (file) {
                if (!getImportType(file)) {
                    grunt.fatal(util.format("Unable to determine the import type of %s", file));
                }
            });
        });
    }

    function getImportType(file) {
        var supported = ["json", "jar", "zip", "jcr.xml", "xml"];
        
        var i;

        for (i = 0; i < supported.length; i++) {
            var extension = "." + supported[i];

            // Is the file using an import type as extension?

            if (file.indexOf(extension, file.length - extension.length) !== -1) {
                return supported[i];
            }
        }
    }

    function getNodeName(file, type) {
        var base = path.basename(file);
        return base.slice(0, base.length - type.length - 1);
    }

    var options = this.task.options({
        host: "localhost",
        port: 8080,
        user: "admin",
        pass: "admin",
        checkin: false,
        autoCheckout: false,
        replace: false,
        replaceProperties: false
    });

    printOptions(grunt, options);

    validateImportTypes(grunt, this.task.files);

    var tasks = [];

    var postServlet = new servlet.Post(options);

    function withWarnings(done) {
        return function (err, response, body) {
            if (err) {
                return done(err);
            }

            var b = JSON.parse(body);

            if (response.statusCode < 200 || response.statusCode >= 300) {
                grunt.warn(util.format("Error writing %s: %s.", b.path, b["status.message"]));
            }

            done(err, response, body);
        };
    }

    function createImportTask(node, file, options) {
        return function (done) {
            var type = getImportType(file);
            var name = getNodeName(file, type);

            grunt.log.writeln(util.format("Importing %s with type '%s'", file, type));

            postServlet.importContent(node, name, file, type, options, withWarnings(done));
        };
    }

    this.task.files.forEach(function (group) {
        group.src.forEach(function (file) {
            tasks.push(createImportTask(group.orig.dest, file, options));
        });
    });

    async.parallel(tasks, this.task.async());
};