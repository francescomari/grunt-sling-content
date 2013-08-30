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
function DirectoryHandler(task, root, resource) {
    this.task = task;
    this.directory = root;
    this.resource = resource;
}

exports.DirectoryHandler = DirectoryHandler;

/**
 * Creates an instance of the POST Servlet wrapper, correctly configured. The
 * instance is cached, multiple invocations of this method will return the
 * same instance.
 * @return {Object} An instance of the POST Servlet wrapper.
 */
DirectoryHandler.prototype.getServlet = function () {
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
DirectoryHandler.prototype.getChildren = function() {
    var self = this;

    if (self.children) {
        return self.children;
    }

    self.children = fs.readdirSync(self.directory);

    return self.children;
};

/**
 * Check if a path points to an existing file.
 * @param  {String}  directory Path of the directory containing the file
 * @param  {String}  file      Name of the file.
 * @return {Boolean}           True if the path points to an existing file.
 */
DirectoryHandler.prototype.isFile = function(directory, file) {
    return self.task.grunt.file.isFile(directory, file);
};

/**
 * Reads the children files of the current directory. Returns an array of file
 * names. The returned array is cached, multiple invocations of this method
 * will return the same array.
 * @return {Array} Array of names for children files of the current directory.
 */
DirectoryHandler.prototype.getFiles = function() {
    var self = this;

    if (self.files) {
        return self.files;
    }

    function filesOnly(child) {
        return self.isFile(self.directory, child) && path.extname(child) !== ".json";
    }

    self.files = self.getChildren().filter(filesOnly);

    return self.files;
};

/**
 * Check if a path points to an existing directory.
 * @param  {String}  directory Path of the directory containing the directory.
 * @param  {String}  name      Name of the directory.
 * @return {Boolean}           True if the path points to an existing
 *     directory.
 */
DirectoryHandler.prototype.isDir = function(directory, name) {
    return self.task.grunt.file.isDir(directory, name);
};

/**
 * Reads the children directories of the current directory. Returns an array
 * of directory names. The returned array is cached, multiple invocations of
 * this method will return the same array.
 * @return {Array} Array of names for children directories of the current
 *     directory.
 */
DirectoryHandler.prototype.getDirectories = function() {
    var self = this;

    if (self.directories) {
        return self.directories;
    }

    function directoriesOnly(child) {
        return self.isDir(self.directory, child);
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
DirectoryHandler.prototype.getDescriptors = function() {
    var self = this;

    if (self.descriptors) {
        return self.descriptors;
    }

    self.descriptors = self.getChildren().filter(function (child) {
        return self.isFile(self.directory, child) && path.extname(child) === ".json";
    });

    return self.descriptors;
};

/**
 * Wrapper around the grunt.file.readJSON() method.
 * @param  {String} path Path of the JSON file.
 * @return {Object}      Parsed JSON object.
 */
DirectoryHandler.prototype.readJSON = function(directory, name) {
    return self.task.grunt.file.readJSON(path.join(directory, name));
};

/**
 * Return a map of descriptor files. The map will have as keys the base name
 * of the descriptor file (without the ".json" extension), and as value the
 * content of the corresponding descriptor file, already parsed.
 * @return {Object} Map of descriptor names to descriptor contents.
 */
DirectoryHandler.prototype.getDescriptorMap = function() {
    var self = this;

    if (self.descriptorMap) {
        return self.descriptorMap;
    }

    function toDescriptorMap(map, descriptor) {
        var base = path.basename(descriptor, ".json");

        var json = self.readJSON(self.directory, descriptor);

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
DirectoryHandler.prototype.propertiesFor = function(name, initial) {
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
DirectoryHandler.prototype.decorateCallback = function(callback) {
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
DirectoryHandler.prototype.getFileTasks = function() {
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
DirectoryHandler.prototype.getDirectoryTasks = function() {
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
DirectoryHandler.prototype.getUnusedDescriptorNames = function() {
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
DirectoryHandler.prototype.getNodeTasks = function() {
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
DirectoryHandler.prototype.getRecursionTasks = function() {
    var self = this;

    function toRecursionTask(directory) {
        return function (done) {
            var newRoot = path.join(self.directory, directory);
            var newResource = concatResource(self.resource, directory);
            
            var poster = new DirectoryHandler(self.task, newRoot, newResource);
            
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
DirectoryHandler.prototype.post = function(done) {
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
    this.printOptions();    
    this.validate();
    this.postDirectories(this.task.async());
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
                new DirectoryHandler(self, directory, group.orig.dest).post(done);
            });
        });
    });

    async.parallel(tasks, done);
};

/**
 * Task to import content into Sling using the import operation of the POST
 * Servlet.
 * @param {Object} grunt The Grunt main object.
 * @param {Object} task The task object ("this" inside the task function).
 */
function SlingImport(grunt, task) {
    this.grunt = grunt;
    this.task = task;
}

exports.SlingImport = SlingImport;

/**
 * Return the option object, with default values used if none is provided from
 * the user.
 * @return {Object} Option object.
 */
SlingImport.prototype.getOptions = function() {
    if (this.options) {
        return this.options;
    }

    this.options = this.task.options({
        host: "localhost",
        port: 8080,
        user: "admin",
        pass: "admin",
        checkin: false,
        autoCheckout: false,
        replace: false,
        replaceProperties: false
    });

    return this.options;
};

/**
 * Print the options to the Grunt logger.
 */
SlingImport.prototype.printOptions = function() {
    var options = this.getOptions();
    var writeln = this.grunt.verbose.writeln;

    writeln("Host: " + options.host);
    writeln("Port: " + options.port);
    writeln("User: " + options.user);
    writeln("Checkin: " + options.checkin);
    writeln("Auto-checkout: " + options.checkin);
    writeln("Replace: " + options.checkin);
    writeln("Replace properties: " + options.checkin);
};

/**
 * Compute the improt type to be performed for a given file.
 * @param  {String} file File to compute the import type for.
 * @return {String} The import type to perform for the given file.
 */
SlingImport.prototype.getImportType = function(file) {
    var supported = ["json", "jar", "zip", "jcr.xml", "xml"];
        
    var i;

    for (i = 0; i < supported.length; i++) {
        var extension = "." + supported[i];

        if (file.indexOf(extension, file.length - extension.length) !== -1) {
            return supported[i];
        }
    }

    return null;
};

/**
 * Validate the input files provided by the user.
 */
SlingImport.prototype.validate = function() {
    var self = this;

    self.task.files.forEach(function (group) {
        group.src.forEach(function (file) {
            if (self.getImportType(file) === null) {
                self.grunt.fatal(util.format("Unable to determine the import type of %s", file));
            }
        });
    });
};

/**
 * Creates an instance of the POST Servlet wrapper, correctly configured. The
 * instance is cached, multiple invocations of this method will return the
 * same instance.
 * @return {Object} An instance of the POST Servlet wrapper.
 */
SlingImport.prototype.getServlet = function() {
    if (this.servlet) {
        return this.servlet;
    }

    this.servlet = new servlet.Post(this.getOptions());

    return this.servlet;
};

/**
 * Decorate the callback which will be passed to the POST Servlet. The
 * decorated callback will parse the JSON response of the POST Servlet and
 * will print a warning if an error occurs.
 * @param  {Function} callback Original callback.
 * @return {Function} A function wrapping the original callback and adding
 *     functionalities.
 */
SlingImport.prototype.decorateCallback = function(callback) {
    var self = this;

    return function (err, response, body) {
        if (err) {
            return callback(err);
        }

        var b = JSON.parse(body);

        if (response.statusCode < 200 || response.statusCode >= 300) {
            self.grunt.warn(util.format("Error writing %s: %s.", b.path, b["status.message"]));
        }

        callback(err, response, body);
    };
};

/**
 * Compute the node name of a file. To compute the node name, the import type
 * extension is stripped out of the base name of the file.
 * @param  {String} file The file to compute the node name for.
 * @param  {String} type The import type.
 * @return {String} The node name of the file.
 */
SlingImport.prototype.getNodeName = function(file, type) {
    var base = path.basename(file);
    return base.slice(0, base.length - type.length - 1);
};

/**
 * Create the task functions to import the content files into Sling.
 * @return {Array} Array of task functions.
 */
SlingImport.prototype.getImportTasks = function() {
    var self = this;

    var tasks = [];

    function createImportTask(node, file) {
        return function (done) {
            var type = self.getImportType(file);
            var name = self.getNodeName(file, type);
            var options = self.getOptions();
            var callback = self.decorateCallback(done);

            self.grunt.log.writeln(util.format("Importing %s with type '%s'", file, type));

            self.getServlet().importContent(node, name, file, type, options, callback);
        };
    }

    self.task.files.forEach(function (group) {
        group.src.forEach(function (file) {
            tasks.push(createImportTask(group.orig.dest, file));
        });
    });

    return tasks;
};

/**
 * Import each content file passed to the task into Sling.
 * @param  {Function} done Callback to be called when the import of each file
 *     is finished.
 */
SlingImport.prototype.importFiles = function(done) {
    async.parallel(this.getImportTasks(), done);
};

/**
 * Executes the import task.
 */
SlingImport.prototype.run = function() {
    this.printOptions();
    this.validate();
    this.importFiles(this.task.async());
};