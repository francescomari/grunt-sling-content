# Grunt Sling Content

[![Build Status](https://travis-ci.org/francescomari/grunt-sling-content.png?branch=master)](https://travis-ci.org/francescomari/grunt-sling-content)

This plugin is a collection of tasks which use the Sling POST servlet to upload or import content into a running Sling instance.

## Table of contents

- [Installation](#installation)
- [Creating content](#creating-content)
- [Importing content](#importing-content)
- [Examples](#examples)

## Installation

To use this plugin, you have to install Grunt first. Please follow the [installation instructions](http://gruntjs.com/getting-started) for Grunt in the official documentation.

To install the plugin, simply invoke NPM from the root of your project.

```
npm install grunt-sling-content
```

Optionally, you can save the dependency in your `package.json` by adding a command line option as shown below.

```
npm install --save-dev grunt-sling-content
```

## Creating content

This plugin contains a task, `slingPost`, which is able to upload to Sling a local directory and its content, recursively. The task traverses the directory and, for each file and folder, performs the following actions:

-   For each folder, a new node is created of type `sling:Folder`. If a `.json` file exists with the same name as the directory, this file is read to obtain additional properties for the node representing the folder.
-   For each file which is not a `.json` file, a new node is created of type `nt:file`. If a `.json` file exists with the same name as the directory, this file is read to obtain additional properties for the node representing the file.
-   For each `.json` file, if the file has not been used in one of the following steps, then it is used to create a new node. The properties contained in this file (including `jcr:primaryType`) will be used when the node is created.

The content can be uploaded multiple times. If the resource doesn't exist, the Sling POST servlet will create a new one; otherwise, the existing resource will be updated with new property values and file contents, if they changed after the last upload.

The task can only push new changes to nodes and properties to the Sling instance, but it will never remove anything. If you want to remove a node or a property which has been pushed by a previous invocation of the task, you have to do it manually. In this case, the Content Explorer embedded in Sling can be helpful.

### Usage

To publish to a running Sling instance the content of the `root` folder, you have to update the contents of `Gruntfile.js` to reference and configure the `slingPost` task.

```javascript
module.exports = function (grunt) {
    grunt.initConfig({
        slingPost: {
            root: {
                src: "root",
                dest: "/"
            }
        }
    });

    grunt.loadNpmTasks("grunt-sling-content");

    grunt.registerTask("default", ["slingPost"]);
};
```

Invoking the task to push the content in the `root` folder is as simple as invoking `grunt` from the root of your project.

### Options

The `slingPost` task accepts the following options:

-	`host`: String, the host name of the Sling instance. Defaults to `localhost`.
-	`port`: integer, the port name of the Sling instance. Defaults to `8080`.
-	`user`:	String, the name of a user which has enough privileges to access the post servlet. Defaults to `admin`.
-	`pass`: String, the password for the user specified in the `user` option. Defaults to `admin`.

## Importing content

The `slingImport` task contained in this plugin uses the [import operation](http://sling.apache.org/documentation/bundles/manipulating-content-the-slingpostservlet-servlets-post.html#importing-content-structures) of the Sling POST servlet to import a content structure into a running Sling instance. 

The content to import can be stored in different formats. At the moment the task supports importing content in `json`, `jar`, `zip`, `xml` and `jcr.xml` formats.

### Usage

Let's say you have some content in the `src/content-tree.json` file. You want to import this content under the `/content/data` node in your Sling instance. To perform the import, you have to update the contents of `Gruntfile.js` to reference and configure the `slingImport` task.

```javascript
module.exports = function (grunt) {
    grunt.initConfig({
        slingImport: {
            contentTree: {
                src: "src/content-tree.json",
                dest: "/content/data"
            }
        }
    });

    grunt.loadNpmTasks("grunt-sling-content");

    grunt.registerTask("default", ["slingImport"]);
};
```

The `slingImport` task will create a new node in `/content/data/content-tree`. The name of the new node is the same as the import file, excluding the extension. Because the extension of the file is `.json`, the task will perform an import of type `json`. The properties and the sub-nodes of the newly created node will be fetched from the import file.

### Options

The `slingImport` task accepts the following options:

-   `host`: String, the host name of the Sling instance. Defaults to `localhost`.
-   `port`: integer, the port name of the Sling instance. Defaults to `8080`.
-   `user`: String, the name of a user which has enough privileges to access the post servlet. Defaults to `admin`.
-   `pass`: String, the password for the user specified in the `user` option. Defaults to `admin`.
-   `checkin`: boolean, determines if versionable nodes should be checked in during the import. Defaults to `false`.
-   `autoCheckout`: boolean, determines if versionable nodes should be checked out during the import. Defaults to `false`.
-   `replace`: boolean, determines if existing nodes will be replaced during the import. Defaults to `false`.
-   `replaceProperties`: boolean, determines if the properties of existing nodes will be replaced during the import. Defaults to `false`.

## Examples

To try example applications, some preparation steps are required. First of all, you need to create this repository and to install the dependencies required by the task.

```
git clone https://github.com/francescomari/grunt-sling-content
cd grunt-sling-content
npm install
```

In addition, you have to run a Sling instance on your local machine, at the default port (`8080`). Each example application also use the default `admin` user to push content to the repository.

Once everything is in place, you can try the example application you prefer by invoking `grunt` in its root. For the `blog` example application, you would do something like

```
cd examples/blog
grunt
```
