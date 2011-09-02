/*
Copyright (c) 2011, Radu Viorel Cosnita <radu.cosnita@gmail.com>

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

"use strict";

/**
 * This module provide support for tag factories. Parser will use this tag factory
 * for correctly handling a specific tag.
 */

var mod_taghandlerlink 		= require("./taghandlerlink"),
	mod_taghandlerscript 	= require("./taghandlerscript"),
	mod_taghandlertext 	= require("./taghandlertext"),
	mod_logger        		= require('../logger'), 
	logger            		= mod_logger.getLogger('TagFactory', mod_logger.Logger.SEVERITY.INFO);

function TagFactory() {	
	this.supportedTagHandlers = {
		"link"		: mod_taghandlerlink.TagHandlerLink,
		"script"	: mod_taghandlerscript.TagHandlerScript,
		"tx:text"	: mod_taghandlertext.TagHandlerText
	}; 	
}

/**
 * Method used to determine if a tag is supported by this factory
 * or not.
 * 
 * @param tag
 * @param prefix
 */
function isTagSupported(tag, prefix) {	
	var key = tag;
	
	if(prefix) {
		key = prefix + ":" + tag;
	}
	
	return this.supportedTagHandlers[key] ? true : false;
}

/**
 * Method used to handle the tag.
 */
function handleTag(prefix, tag, attributes, body, fnCollector) {
	if(!this.isTagSupported(tag, prefix)) {
		throw new Error("Tag " + tag + " is not supported by tag factory.");
	}
	
	var handler = new this.supportedTagHandlers[tag](prefix, tag, attributes, body);
	
	if(!fnCollector) {
		fnCollector = function(data) {};
	}
	
	var data = handler.handleTag();
	
	fnCollector(data);
	
	return true;
}

TagFactory.prototype.isTagSupported = isTagSupported;
TagFactory.prototype.handleTag = handleTag;

var tagFactory = new TagFactory();

exports.TagFactory = tagFactory;