/*
Copyright (c) 2011, Cosnita Radu Viorel <radu.cosnita@1and1.ro>
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:
    * Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.
    * Neither the name of the <organization> nor the
      names of its contributors may be used to endorse or promote products
      derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL <COPYRIGHT HOLDER> BE LIABLE FOR ANY
DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

/**
 * @author Radu Viorel Cosnita
 * @version 1.0
 * @since 17.11.2011
 * @see https://github.com/juxtapos/Rain/wiki/Features-proposal-client-messaging-a
 * @see https://github.com/juxtapos/Rain/wiki/Features-proposal-rain-user-preferences
 * @description This module provide the resolving mechanism for intents requests. 
 */

"use strict";

var modPath         = require('path')
    , modPromise    = require('promised-io/promise')
    , modTagFactory = require("../tagparsing/tagfactory")
    , logger        = require("../logger").getLogger(modPath.basename(module.filename))
    , exceptions    = require("./intents_exceptions");

exports.IntentsResolver = IntentsResolver;

/**
 * Class used to resolve intents.
 * 
 * @param {IntentsRegistry} intentsRegistry: This is the current intents registry that holds all registered intents.
 */
function IntentsResolver(componentcontainer, intentsRegistry) {
    this._intentsRegistry = intentsRegistry;
    this._componentContainer = componentcontainer;
    this._supportedIntents = {"view": this._getIntentComponentView,
                              "server": this._getIntentComponentServer};
    
    logger.debug("Intents resolver instantiated.");
}

/**
 * Method used to resolve an the requested intent. It receives the information sent 
 * by requester in intentContenxt. This method can throw exceptions in case the 
 * intent is not found.
 * 
 * @param {String} category: Intent category as specified in meta.json file.
 * @param {String} action: Intent action as specified in meta.json file.
 * @param {Dictionary} intentContext: Parameters sent by requester so that it influences the intent behavior at load / processing time. For instance a requester
might send a recipients list to an external send mail application.
 * @param {Dictionary} preferences: A dictionary containing all user preferences as currently stored.
 * 
 * @returns {Dictionary} Returns a list of handlers if found. In case only one handler is found then
renderer is invoked (async) and a promise is returned.
 */
IntentsResolver.prototype.resolveIntent = function(category, action, intentContext, preferences) {
    logger.debug("Resolve intent " + category + "," + action);
    
    var handlers = this._getIntentProviders(category, action);
    
    if(handlers.length == 0) {
        return [];
    }
            
    if(handlers.length > 1) {
        // multiple potential handlers: the platform will ask user for the preference.
        
        return handlers;
    }
    
    var renderPromise = new modPromise.defer();
    
    var handler = handlers[0];
    handler.intentContext = intentContext;
    
    this._renderIntent(handler, function(renderResult) {
       renderPromise.resolve(renderResult); 
    });
        
    return renderPromise.promise;
}

/**
 * Method used to render an intent. The renderer will retrieve the markup if necessary.
 * 
 * @param {Dictionary} intent: Intent context.
 * @param {function} onRendered: Callback method invoked when the 
 */
IntentsResolver.prototype._renderIntent = function(intent, onRendered) {
    logger.debug("Pushing intent " + JSON.stringify(intent) + " to render.");
                
    this._getIntentComponent(intent, onRendered)    
}

/**
 * Method used to obtain the intent component that can be rendered to the client.
 * 
 * @param {Dictionary} intent: the intent definition
 * @param {function} onCompLoaded: the method executed when the component is completely loaded.
 * It accepts a single parameter which represents the data from the component.
 * @return {WebComponent} a web component instance.
 */
IntentsResolver.prototype._getIntentComponent = function(intent, onCompLoaded) {        
    var intentType = intent.type;
       
    if(!this._supportedIntents[intentType]) {
        throw new Error("Intent type " + intentType + "is not supported.");
    }

    var component = this._supportedIntents[intentType].apply(this, [intent]);
    
    component.then(function(componentResult) {
        onCompLoaded(componentResult);
    });
}

/**
 * Method used to obtain the component starting from an intent mapped to a view.
 * 
 * @param {Dictionary} intent: The current intent.
 * @param {TagFactory} testTagFactory: tag factory dependency injection. This is really
 * useful when testing the method.
 * 
 * @return A promise referencing the asynchronous process that is currently rendering
 * the component of the intent.
 */
IntentsResolver.prototype._getIntentComponentView = function(intent, testTagFactory) {   
    var moduleId = intent.provider.module.id;
    var moduleVersion = intent.provider.module.version;
    var viewPath = intent.provider.view; 
    
    var componentId =  moduleId + ";" + moduleVersion;

    if(!testTagFactory) {
        testTagFactory = modTagFactory;
    }
        
    var tagFactory = new testTagFactory.TagFactory(this._componentContainer);
       
    var component = this._componentContainer.createComponent(componentId);
    
    var defer = new modPromise.defer();
    
    var req = {"session": intent.intentContext.session};
            
    component.initialize(viewPath, "html", {},  
                req, undefined, undefined, 
                tagFactory);
                    
    component.once("rendered", function(component) {
        var renderer = component.renderer;       
        
        defer.resolve(renderer.renderresult);
    });         
    
    return defer.promise;
}

/**
 * Method used to execute an intent mapped to a server side controller.
 * 
 * @param {Dictionary} intent: current intent request configuration.
 * @param {method} testRequire: Mocked require method. Used only for unit testing.
 */
IntentsResolver.prototype._getIntentComponentServer = function(intent, testRequire) {
    var moduleId = intent.provider.module.id;
    var moduleVersion = intent.provider.module.version;
    
    var serverController = intent.provider.path;
    var method = intent.provider.method;
    
    var fnRequire = testRequire || require;
    
    var controller = fnRequire(serverController);

    var intentCtx = intent.intentContext;
    var session = intentCtx.session;

    var defer = new modPromise.defer();
    
    defer.resolve(controller[method](intentCtx, session));
    
    return defer.promise;
}

/**
 * Method used to obtain the preferred handler. It always take in consideration
 * cases when the preferences are not accurate anymore: for instance the intent from
 * preferences was removed from platform. 
 * 
 * @param {String} category: intent category
 * @param {String} action: intent action
 * @param {String} preferences: current user preferences.
 */
IntentsResolver.prototype._getPreferredHandler = function(category, action, preferences) {
    logger.debug("Obtaining preferred handler for " + category + "," + action);
    
    var intents = this._intentsRegistry.intents;

    if(!preferences) {
        return;
    }
            
    var categCtx = preferences[category]; 
    
    if(!categCtx) {
        return;
    }
    
    var intentId = categCtx[action];
    
    if(!intentId) {
        return;
    }
    
    categCtx = intents[category];
    if(!categCtx) {
        return;
    } 
    
    var actionCtx = categCtx[action];
    
    if(!actionCtx) {
        return;
    }
    
    var intent = actionCtx[intentId];
        
    return intent;
}

/**
 * Method used to extract all candidates for handling the specified intent.
 */
IntentsResolver.prototype._getIntentProviders = function(category, action, preferences) {
    var categoryCtx = this._intentsRegistry.intents[category]; 
    var handlers = [];
    
    if(!categoryCtx) {
        throw new exceptions.IntentCategoryNotFound("Category " + category + " not found.");
    }
    
    var actionCtx = categoryCtx[action];
    
    if(!actionCtx || JSON.stringify(actionCtx) == "{}") {
        throw new exceptions.IntentActionNotFound();
    }
    
    var intent = this._getPreferredHandler(category, action, preferences);
    
    if(intent) {
        return [intent];
    }
       
    for(var intentKey in actionCtx) {
        intent = actionCtx[intentKey];
        // TODO please check for autorization here.
        
        handlers.push(intent);
    }
    
    if(handlers.length == 0) {
        throw new exceptions.IntentActionNotFound("No matching intent for action " + action);
    }

    return handlers;
}