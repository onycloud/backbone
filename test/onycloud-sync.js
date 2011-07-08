$(document).ready(function() {
  var new_data,
      jqueryAjax = $.ajax,
      lastRequest,
      teacher;

  var nested_data = {
    id: 1,
    status: 'old',
    students: [{id:1, name: 'a'}, {id: 2, name: 'b'}],
    info: {
      id: 1,
      name: 'name',
      sex : false
    }
  };


  module("Onycloud.sync", {
    teardown: function() {
      $.ajax = jqueryAjax;      // restore
    },
    setup : function() {
      jqueryAjax = $.ajax;
      new_data = {status: "new",  www: "what"};
      var Model = OC_Backbone.Model.extend({
        students : OC_Backbone.Collection.extend({}),
        info     : OC_Backbone.Model,
        url      : "/diffs",
        sync     : OC_Backbone.sync
      });

      var data = {_op: '!',
                  _data: {
                    status: 'new',
                    www: 'what',
                    id: 1,
                    students: [
                      {_op: '+', _data: {id: 100, name: 'new-student'}},
                      {_op: '-', _data: {id: 1}}]}};
      teacher = new Model(nested_data);
      $.ajax = function(obj) {         // mock $.ajax
        lastRequest = obj;
        var dfr = $.Deferred();
        _.delay(function() {
          dfr.resolve(data, 'success');
        }, 100);
        return dfr.promise();
      };
    }});

  asyncTest("Model.savediff: send diff", function() {
    teacher.snapshot();
    var students = teacher.get('students');
    students.add({name: 'new-student'});
    students.remove(students.get(1));
    teacher.set(new_data);
    teacher.savediff().done(function() {
      equals(students.length, 2, "2 students");
      equals(students.get(1), undefined, "student 1 is removed");
      equals(students.get(100).get('name'), "new-student",
             "name is returned");
      equals(teacher.get('status'), 'new', "status changed to new");
      start();
    });
  });
});
