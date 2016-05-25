"use strict";

var gulp        = require("gulp");
var changed     = require("gulp-changed");
var ngAnnotate  = require("gulp-ng-annotate");
var uglify      = require("gulp-uglify");
var concat      = require("gulp-concat");
var rename      = require("gulp-rename");
var jsHint      = require("gulp-jshint");
var jscs        = require("gulp-jscs");
var jscsStylish = require("gulp-jscs-stylish");

function copyChangedFiles(sourceStream, buildDirectory) {
  return sourceStream.pipe(changed(buildDirectory)).pipe(gulp.dest(buildDirectory));
}

var paths = ["./src/*.js"];

gulp.task("default", ["build"]);

gulp.task("lint", function () {
  return gulp.src(paths)
    .pipe(jsHint())
    .pipe(jscs())
    .pipe(jscsStylish.combineWithHintResults())
    .pipe(jsHint.reporter("jshint-summary"))
    .pipe(jsHint.reporter("fail"));
});

gulp.task("concat", ["lint"], function () {
  return gulp.src(paths)
    .pipe(ngAnnotate())
    .pipe(concat("babili-angular.js"))
    .pipe(gulp.dest("dist"));
});

gulp.task("build", ["concat"], function () {
  return gulp.src(["./dist/babili-angular.js"])
    .pipe(uglify())
    .pipe(rename("babili-angular.min.js"))
    .pipe(gulp.dest("dist"));
});

gulp.task("watch", ["build"], function () {
  return gulp.watch(paths, ["build"]);
});
