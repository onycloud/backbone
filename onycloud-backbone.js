/* Extend Backbone's Model and Collection and Sync to support
 * 1. nested data
 * 2. only send diff to server, diff computed in a recursive manner
 *    a) diff begin with call to snapshot()
 *    b)  server respond with a diff
 *    c) example data format
 *        request or responce : {
 *          _op: '!',
 *          _data: {
 *             name: 'name',
 *             nested_data: [
 *                 {_op: '+', _data: {.....}}
 *             ]
 *          }
 *        }
 *    d) three _op are define !(update), +(create), -(delete)
 */

(function() {
  var root = window;            // save a reference
  var Backbone = root.Backbone, // js2-mode complains if don't
      $ = root.jQuery,
      JSON = root.JSON,
      _ = root._;
  var backboneSync = Backbone.sync; // save it;

  var Model = Backbone.Model.extend({

    toJSON : function() {         // recursive
      var val, json = _.clone(this.attributes);
      for(var attr in json) {
        val = json[attr];
        if(val && json.hasOwnProperty(attr) &&  _.isFunction(val.toJSON)) {
          json[attr] = val.toJSON();
        }
      }
      return json;
    },

    // copy and modify Backbone's set to support recursive
    set : function(attrs, options) {
      // Extract attributes and options.
      options || (options = {});
      if (!attrs) return this;
      if (attrs.attributes) attrs = attrs.attributes;

      // Run validation.
      if (!options.silent && this.validate &&
          !this._performValidation(attrs, options)) {
        return false;
      }
      // Check for changes of `id`.
      if (this.idAttribute in attrs) this.id = attrs[this.idAttribute];

      // We're about to start triggering change events.
      var alreadyChanging = this._changing;
      this._changing = true;

      // Update attributes.
      for (var attr in attrs) {
        this._set(attr, attrs[attr], options);
      }

      // Fire the `"change"` event, if the model has been changed.
      if (!alreadyChanging && !options.silent && this._changed) {
        this.change(options);
      }
      this._changing = false;
      return this;
    },

    _set : function(attr, newval, options) {
      var Klass =  this[attr],
          now = this.attributes,
          oldval = now[attr],
          escaped = this._escapedAttributes;

      if (_.isEqual(newval, oldval)) return;

      // Use duck typing to check if Klass inherits Model/Collection
      if(_.isArray(newval) && Klass && _.isFunction(Klass.prototype.reset)) {
        now[attr] = oldval ? oldval.reset(newval, options)
          : new Klass(newval, options);
      } else if ($.isPlainObject(newval) && Klass
                 && _.isFunction(Klass.prototype.set)) {
        now[attr] = oldval ? oldval.set(newval, options)
          : new Klass(newval, options);
      } else {
        now[attr] = newval;
      }

      delete escaped[attr];
      this._changed = true;
      if (!options.silent) {
        this.trigger('change:' + attr, this, now[attr], options);
      }
    },
    //  save diff since last time call snapshot
    savediff : function (options) {
      var sync = (this.sync || Backbone.sync),
          that = this;
      var ajax = sync.call(this,'sync', this, options);
      ajax.done(function(diff, status, xhr) {
        that.applydiff(diff);
      });
      return ajax;
    },

    applydiff : function (diff) {
      // `add(+)`, `delete(-)` is handled by Colleciton
      switch(diff._op) {
      case '!':                 // modify
        var data = diff._data, val;
        for( var attr in data ) {
          val = data[attr];
          if(_.isArray(val) || isObject(val)) { // a collection/model
            this.get(attr).applydiff(val);
          } else {
            this._set(attr, val);
          }
        }
        break;
      }
    },

    // take a snapshot the model's state, later used to compute diff
    snapshot: function() {
      // shadowed, nested are not copyed
      this._snapshotAttributes = _.clone(this.attributes);
      _.each(this.attributes, function(val, key) {
        // model or collection, take their own
        if(val && _.isFunction(val.snapshot)){
          val.snapshot();
        }
      });
    },

    // compute diff since snapshot, recursive,  internal use
    _diff : function() {
      if (this.isNew()) {       // new, return all, create
        return {
          _op: '+', _data: _.clone(this.attributes)
        };
      } else if (!this._snapshotAttributes) {
        throw new Error("please invoke snapshot() first");
      } else {
        var now = this.attributes,
            old = this._snapshotAttributes, changed = {};
        for (var attr in now) {
          var nowVal = now[attr], oldVal = old[attr];
          if(nowVal && _.isFunction(nowVal._diff)) { // a model or collection
            var tmp = nowVal._diff();
            if(tmp) {
              changed[attr] = tmp;
            }
          } else if ( !_.isEqual(oldVal, nowVal)) { // plain data
            changed[attr] = nowVal;
          }
        }
        if(_.isEmpty(changed)) { // no change detected
          return false;         // return false simplify other code
        }
        // server need id to determine which to udpate
        changed[this.idAttribute] = this.id;
        return { _op: '!', _data: changed};
      }
    }
  });

  var Collection = Backbone.Collection.extend({

    model: Model,               // OC.Collection needs OC.Model

    // 1. save a snapshot of ids to detect any remove,
    // 2. all model recursivly do snappshot
    snapshot : function() {
      if(this.length > 0) {
        var idAttribute =  this._getModelIDAttribute(),
            ids = _.compact(this.pluck(idAttribute));
        this._modelIdAttribute = idAttribute; // save models' id attribute
        this._previousIds = ids; // save a snapshot
        this.map(function(model) {      // all model recusive do it
          model.snapshot();
        });
      }
    },

    // get model's idAttrubute
    _getModelIDAttribute : function() {
      return this.length > 0 ? this.models[0].idAttribute :
        this._modelIdAttribute;
    },

    applydiff : function(diff) {
      var that = this,
          idAttribute = this._getModelIDAttribute();
      _.each(diff, function(ele) {
        var op = ele._op, data = ele._data;
        switch(op) {
        case '-':
          that.remove(that.get(data[idAttribute]));
          break;
        case '+':
          that.add(data);
          break;
        case '!':
          that.get(data[idAttribute]).applydiff(data);
          break;
        }
      });
      // remove any new model. we've added it in `+`
      this.remove(this.select(function(model) {
        return model.isNew();
      }));
    },

    _diff : function() {
      var idAttribute = this._getModelIDAttribute(),
          ids = _.compact(this.pluck(idAttribute)),
          removed = _.filter(this._previousIds, function(value) {
            return !_.include(ids, value);
          }),
          modelsDiff = _.compact(this.map(function (model) {
            return model._diff();
          }));

      // changed = removed + modified + newly
      var changed = modelsDiff.concat(_.map(removed, function(id) {
        var data = {};
        data[idAttribute] =id;
        return { _op: '-',_data: data}; // delete
      }));

      if(changed.length === 0) changed = false;
      return changed;
    }
  });

  // a wrapper of backbone's sync to support diffs
  var sync = function(method, model, options) {
    if(method !== 'sync') {
      return backboneSync(method, model, options); // default
    } else {
      var params = _.extend({     // Default JSON-request options.
        type        : 'POST',
        dataType    : 'json',
        processData : false
      }, options);

      if (!params.url) {    // Ensure that we have a URL.
        params.url = getUrl(model);
      }

      // Ensure that we have the appropriate request data.
      if (!params.data && model instanceof Model) {
        params.contentType = 'application/json';
        var diff = model._diff();
        if (!diff) {
          throw new Error("no diff find");
        }
        params.data = JSON.stringify(diff);
      }
      // Backbone.Sync support emulateHTTP & emulateJSON.
      return $.ajax(params); // Make the request. return a jQuery defered
    }
  };

  // String, Numbers, Boleans are not object, object literal are object
  var isObject = function(obj) {
    return obj.constructor === Object;
  };

  // Copyed from Backbone
  var getUrl = function(object) {
    if (!(object && object.url)) {
      throw new Error('A "url" property or function must be specified');
    };
    return _.isFunction(object.url) ? object.url() : object.url;
  };

  root.OC_Backbone = $.extend(root.OC_Backbone, {   // export
    Model      : Model,
    Collection : Collection,
    sync       : sync           // export
  });
  Backbone.sync = sync;         // wrap backbone sync
})();
