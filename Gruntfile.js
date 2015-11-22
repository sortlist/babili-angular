(function () {
  "use strict";

  module.exports = function (grunt) {

    grunt.initConfig({
      jshint: {
        files: ["Gruntfile.js", "src/**/*.js", "test/**/*.js"],
        options: {
          reporter: require("jshint-stylish")
        }
      },
      concat: {
        js: {
          src: ["src/babili.provider.js", "src/**/*.js"],
          dest: "dist/babili.js"
        }
      },
      ngAnnotate: {
        options: {},
        js: {
          src: ["dist/babili.js"],
          dest: "dist/babili.js"
        }
      },
      uglify: {
        "babili": {
          files: {
            "dist/babili.min.js": ["dist/babili.js"]
          }
        }
      },
      watch: {
        scripts: {
          files: ["src/babili.provider.js", "src/**/*.js"],
          tasks: ["jshint", "concat", "clean"],
          options: {
            spawn: false
          }
        }
      },
      clean: {
        tmp: [".tmp"]
      }
    });

    grunt.loadNpmTasks("grunt-contrib-jshint");
    grunt.loadNpmTasks("grunt-contrib-concat");
    grunt.loadNpmTasks("grunt-contrib-clean");
    grunt.loadNpmTasks("grunt-contrib-watch");
    grunt.loadNpmTasks("grunt-ng-annotate");
    grunt.loadNpmTasks("grunt-contrib-uglify");
    grunt.registerTask("default", ["build"]);
    grunt.registerTask("dev", ["build", "watch"]);
    grunt.registerTask("build", ["jshint", "concat", "ngAnnotate", "uglify", "clean"]);
  };
}());
