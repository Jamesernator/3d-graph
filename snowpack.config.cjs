"use strict";

module.exports = {
    mount: {
        src: "/",
    },
    optimize: {
        preload: true,
        minify: true,
        target: "esnext",
    },
    buildOptions: {
        clean: true,
        out: "./web/",
    },
    devOptions: {
        output: "stream",
    }
};
