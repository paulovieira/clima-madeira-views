var Path = require("path");

var Hoek = require("../clima/node_modules/hoek");
var _ = require("../clima/node_modules/underscore");
var Nunjucks = require('../clima/node_modules/hapi-nunjucks');
var Config = require('../clima/node_modules/config');

var Utils = require("../clima/lib/common/utils");
var Validate = require("../clima/lib/common/validate");
var Pre = require("../clima/lib/common/prerequisites");

var internals = {};

exports.register = function(server, options, next){

    var pluginName = exports.register.attributes.name;

    // configure nunjucks
    var env = Nunjucks.configure(Path.join(__dirname, "templates"), { 
        autoescape: false,
        watch: false,
        noCache: process.env.NODE_ENV === "production" ? true : false,
        pluginName: pluginName,
        // throwOnUndefined: false,
    });

    internals.addNunjucksFilters(env);
    internals.addNunjucksGlobals(env);

    // expose the Environment object to the outside
    server.expose("env", env);

    server.views({
        path: Path.join(__dirname, "templates"),
        allowAbsolutePaths: true,
        engines: {
            html: Nunjucks
        },
        compileOptions: {
            pluginName: pluginName
        }
    });

    // base routes (any .html file in ./templates gives rise to a route)
    server.route(internals.endpoints);
    
    return next();
};

internals.addNunjucksFilters = function(env){

    env.addFilter('stringify', function(str) {
        return JSON.stringify(str);
    });

    env.addFilter('lorem', function(str, size) {

        var lorem = "";
        if(!str){
            size = size || "small";

            if(size==="small"){
                lorem = "Lorem ipsum dolor sit amet, mnesarchum reprehendunt ut usu. ";
            }
            else if(size==="medium"){
                lorem = "Velit veniam munere his an, pri cu fuisset ponderum, nominavi appellantur ne mea. Vim eu malorum accumsan dissentiet. ";
            }
            else if(size==="big"){
                lorem = "Vim te altera facete conclusionemque, est stet evertitur ad. Possit periculis ocurreret sit te, pri iracundia deseruisse ad. Eum at graecis liberavisse, pro natum novum movet at. Cu mucius aliquip adversarium pro, vidisse fuisset ei mel. Causae meliore necessitatibus cu eos, doming verterem vulputate ut sed, libris commodo laoreet nam at.";
            }
            else {
                lorem = size;
            }
            
            return lorem;
        }

        return str;
    });

};

internals.addNunjucksGlobals = function(env){

    // default lang
    env.addGlobal("lang", "pt");
    env.addGlobal("NODE_ENV", process.env.NODE_ENV);
    env.addGlobal("bundles", Config.get("bundles"));
    env.addGlobal("publicUri", Config.get("publicUri"));
    env.addGlobal("publicPort", Config.get("publicPort"));
};

internals.config = {};

internals.config.generalPage = {

    handler: function(request, reply) {

        Utils.logCallsite(Hoek.callStack()[0]);

        var viewFile = Utils.getView(request);

        console.log("viewFile: ", viewFile);

        // if the lang does not exist, show the 404 template with the default language (english)
        if(!request.params.lang){
            return reply.view('404', {
            }).code(404);
        }

        // update the global "lang" variable in Nunjucks 
        request.server.plugins["clima-web"].env.addGlobal("lang", request.params.lang);


        // TODO: we can filter request.pre.texts to send only the texts for this page

        var context = {
            urlParam1: request.params.level1,
            urlParam2: request.params.level2,
            urlParam3: request.params.level3,
            urlParam4: request.params.level4,
            urlParam5: request.params.level5,
            urlWithoutLang: Utils.getUrlWithoutLang(request.params),
            auth: JSON.parse(JSON.stringify(request.auth)),
            showEnglish: request.pre.showEnglish
            //textsArray: request.pre.texts,
            //defaultTexts: request.server.app.defaultTexts
        };

        // add the data available in request.pre that has been treated and ready to be used
        // in the nunjucks template: texts, textArray, files, etc
        for(var key in request.pre){
            if(request.pre.hasOwnProperty(key)){
                context[key] = request.pre[key];
            }
        }

        //return reply({"abc": 123})
        // to get the texts in the views, instead of the array we want an object whose keys are the ids

        context.editableTexts = context.texts.filter(function(obj){
            return viewFile.indexOf(obj.pageName) >= 0;
        });

        context.editableTexts = _.indexBy(context.editableTexts, "editableId");
        context.texts = _.indexBy(context.texts, "id");
        context.showEnglish = request.pre.showEnglish;
        //console.log("context.editableTexts: ", context.editableTexts);
        // context.editableTexts = _.indexBy(context.editableTexts, "editableId");
  //       console.log("context.editableTexts: ", context.editableTexts);

        var response = reply.view(viewFile, {
            ctx: context
        });

        if(viewFile === "404"){
            response.code(404);
        }

        return response;
    },

    validate: {
        params: Validate.lang
    },
    
    pre: [
        [Pre.abortIfInvalidLang],
        [Pre.readShowEnglish, Pre.readAllTexts],
        [Pre.prepareTextsForView]
    ]



};

internals.config.notFound = {

    handler: function(request, reply) {

        Utils.logCallsite(Hoek.callStack()[0]);

        var context = {
        };

        return reply.view('404', {
            ctx: context
        }).code(404);
    },

    validate: {
        params: Validate.lang
    },
    
    pre: [
        [Pre.abortIfInvalidLang],
        [Pre.readShowEnglish, Pre.readAllTexts],
        [Pre.prepareTextsForView]

    ]

};

internals.endpoints = [

    // if lang param is not given, redirect immediately to the default laguage

    {
        path: "/",
        method: "GET",
        config: {
            handler: function(request, reply) {
                return reply.redirect("/" + Config.get("allowedLanguages")[0]);
            },
            auth: false,
        }
    },

    // ordinary routes

    {
        path: "/{lang}",
        method: "GET",
        config: internals.config.generalPage
    },

    {
        path: "/{lang}/{level1}",
        method: "GET",
        config: internals.config.generalPage
    },

    {
        path: "/{lang}/{level1}/{level2}",
        method: "GET",
        config: internals.config.generalPage
    },

    {
        path: "/{lang}/{level1}/{level2}/{level3}",
        method: "GET",
        config: internals.config.generalPage
    },

    {
        path: "/{lang}/{level1}/{level2}/{level3}/{level4}",
        method: "GET",
        config: internals.config.generalPage
    },

    {
        path: "/{lang}/{level1}/{level2}/{level3}/{level4}/{level5}",
        method: "GET",
        config: internals.config.generalPage
    },


    // catch-all route

    {
        method: "GET",
        path: "/{lang}/{anyPath*}",
        config: internals.config.notFound
    },
];

exports.register.attributes = {
    name: "clima-madeira-views",
    dependencies: []
};
