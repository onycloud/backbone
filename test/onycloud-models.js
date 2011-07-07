$(document).ready(function() {

  module("Onycloud.Model");

  var nested_data = {
    id: 1,
    status: 'new',
    students: [{id:1, name: 'a'}, {id: 2, name: 'b'}],
    info: {
      id: 1,
      name: 'name',
      sex : false
    }
  };

  test("Model: nested attribute", function() {
    var Col =  OC.Collection.extend({});
    var Model = OC.Model.extend({
      students: Col,
      info: OC.Model
    });
    var teacher = new Model(nested_data);
    ok(teacher.get('students') instanceof Col, 'students is a Collection');
    ok(teacher.get('info') instanceof Backbone.Model, 'info is a Model');
    ok(_.isEqual(teacher.toJSON(),nested_data), 'toJSON is recursive');
  });

  test("Model: nested attribute, simple diff", function() {
    var Col =  OC.Collection.extend({});
    var Model = OC.Model.extend({
      students: Col,
      info: OC.Model
    });
    var teacher = new Model(nested_data);
    teacher.snapshot();     // mark a history snapshot
    var new_data = {status: "old", www: "what"};
    teacher.set(new_data);
    new_data = $.extend(new_data, {
      id: 1,
      _method: 'PUT'
    });
    var changed_data = teacher.diff();
    ok(_.isEqual(changed_data, new_data), "simple change should work");
  });

  test("Model: nested attribute, nested model diff", function() {
    var Col =  OC.Collection.extend({});
    var Model = OC.Model.extend({
      students: Col,
      info: OC.Model
    });
    var teacher = new Model(nested_data);
    teacher.snapshot();     // mark a history snapshot
    var new_data = {status: "old",  www: "what"};
    teacher.set(new_data);
    teacher.get('info').set({name: 'new-name'});
    new_data = $.extend(new_data, {id :1,
                                   _method: 'PUT',
                                   info: {name: 'new-name',
                                          _method: 'PUT',
                                          id: 1}});
    var changed_data = teacher.diff();
    ok(_.isEqual(changed_data, new_data), "change nested model should work");
  });

  test("Model: nested attribute, nested collection diff", function() {
    var Col =  OC.Collection.extend({});
    var Model = OC.Model.extend({
      students: Col,
      info: OC.Model
    });
    var teacher = new Model(nested_data);
    teacher.snapshot();     // mark a history snapshot
    var new_data = {status: "old",  www: "what"};
    teacher.set(new_data);
    teacher.get('students').add({name: 'new-student'});
    teacher.get('students').get(1).set({name: 'new-name'});
    new_data = $.extend(new_data, {id: 1,
                                   _method: 'PUT',
                                   students: [{id: 1,
                                               name: 'new-name',
                                               _method: 'PUT'},
                                              {name: 'new-student',
                                               _method: 'POST'}]});
    var changed_data = teacher.diff();
    ok(_.isEqual(changed_data, new_data),
       "change nested collection should work");
  });

  test("Model: nested attribute, nested collection remove diff", function() {
    var Col =  OC.Collection.extend({});
    var Model = OC.Model.extend({
      students: Col,
      info: OC.Model
    });
    var teacher = new Model(nested_data);
    teacher.snapshot();     // mark a history snapshot
    var students = teacher.get('students');
    students.add({name: 'new-student'});
    students.remove(students.get(1));
    var expected_diff = {id: 1,
                         _method: 'PUT',
                         students: [{name: 'new-student',
                                     _method: 'POST' },
                                    {id: 1,
                                     _method: 'DELETE'}]};
    var diff = teacher.diff();
    ok(_.isEqual(expected_diff, diff),
       "change nested collection remove should work");
  });

});
