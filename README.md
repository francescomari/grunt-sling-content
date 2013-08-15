# Grunt Sling Content task

This task uses the Sling POST servlet to upload content to a running Sling instance.

Give a root folder to start the mapping from, the task will traverse it recursively and performs the following actions:

-	For each folder, a new node is created of type `sling:Folder`. If a `.json` file exists with the same name as the directory, this file is read to obtain additional properties for the node representing the folder.
-	For each file which is not a `.json` file, a new node is created of type `nt:file`. If a `.json` file exists with the same name as the directory, this file is read to obtain additional properties for the node representing the file.
-	For each `.json` file, if the file has not been used in one of the following steps, then it is used to create a new node. The properties contained in this file (including `jcr:primaryType`) will be used when the node is created.

The content can be uploaded multiple times. If the resource doesn't exist, the Sling POST servlet will create a new one; otherwise, the existing resource will be updated with new property values and file contents, if they changed after the last upload.

The task can only push new changes to nodes and properties to the Sling instance, but it will never remove anything. If you want to remove a node or a property which has been pushed by a previous invocation of the task, you have to do it manually. In this case, the Content Explorer embedded in Sling can be helpful.

## Installation

To use this task, you have to install Grunt first. Please follow the [installation instructions](http://gruntjs.com/getting-started) for Grunt in the official documentation.

To install the task, simply invoke NPM from the root of your project.

```
npm install grunt-sling-content
```

Optionally, you can save the dependency in your `package.json` by adding a command line option as shown below.

```
npm install --save-dev grunt-sling-content
```

## Usage

Let's assume you have a project with the following directory structure:

```
project/
	root/
		apps/
			blog/
				page/
					GET.esp
				post/
					GET.esp
		content/
			blog/
				first-post.json
			blog.json
	package.json
	Gruntfile.js
```

To publish to a running Sling instance the content of the `root` folder, you have to update the contents of `Gruntfile.js` to reference and configure the task.

```
module.exports = function (grunt) {
    grunt.initConfig({
        "sling-content": {
            root: "root"
        }
    });

    grunt.loadNpmTasks("grunt-sling-content");

    grunt.registerTask("default", ["sling-content"]);
};
```

Invoking the task to push the content in the `root` folder is as simple as invoking `grunt` from the root of your project.

## Options

The task accept the following options:

-	`host`: String, the host name of the Sling instance. Defaults to `localhost`.
-	`port`: integer, the port name of the Sling instance. Defaults to `8080`.
-	`user`:	String, the name of a user which has enough privileges to access the post servlet. Defaults to `admin`.
-	`pass`: String, the password for the user specified in the `user` option. Defaults to `admin`.

## Configuration

This task is a multi-task, so its configuration semantics follow what is already described in the [Grunt documentation](http://gruntjs.com/configuring-tasks). 

The task only accepts input paths which refer to existing folders. Each folder is mapped to the root of the virtual filesystem managed by Sling. In example, if you give as input to the task the folder `root/content` (relative to the root of your project), and this folder contains a file called `page.html`, the path in the Sling repository will be `/page.html`.

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