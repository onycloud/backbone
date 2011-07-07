$(document).ready(function() {
  var new_data,
      jqueryAjax = $.ajax,
      lastRequest;

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
      var Model = OC.Model.extend({
        students : OC.Collection.extend({}),
        info     : OC.Model,
        url      : "/diffs",
        sync     : OC.sync
      });

      var data = {_op: '!',
                  _data: {
                    status: 'new',
                    www: 'what',
                    id: 1,
                    students: [
                      {_op: '+', _data: {id: 100, name: 'new-student'}},
                      {_op: '-', _data: {id: 1}}]}};
      window.teacher = new Model(nested_data);
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
