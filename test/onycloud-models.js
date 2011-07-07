$(document).ready(function() {

  module("Onycloud.Model");

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

  test("Model: nested attribute", function() {
    var Col =  OC.Collection.extend({});
    var Model = OC.Model.extend({
      students: Col,
      info: OC.Model
    });
    var teacher = new Model(nested_data);
    ok(teacher.get('students') instanceof Col, 'students is a Collection');
    ok(teacher.get('info') instanceof Backbone.Model, 'info is a Model');
    var json = teacher.toJSON();
    ok(_.isEqual(json, nested_data), 'toJSON is recursive');
  });

  test("Model: nested attribute, simple diff", function() {
    var Col =  OC.Collection.extend({});
    var Model = OC.Model.extend({
      students: Col,
      info: OC.Model
    });
    var teacher = new Model(nested_data);
    teacher.snapshot();     // mark a history snapshot
    var new_data = {status: "new",  www: "what"};

    teacher.set(new_data);
    var expected_diff = {
      _op: '!',
      _data: $.extend(new_data, {
        id: 1
      })
    };
    var diff = teacher._diff();
    ok(_.isEqual(expected_diff, diff), "simple change should work");
  });

  test("Model: nested attribute, nested model diff", function() {
    var Col =  OC.Collection.extend({});
    var Model = OC.Model.extend({
      students: Col,
      info: OC.Model
    });
    var teacher = new Model(nested_data);
    teacher.snapshot();     // mark a history snapshot
    var new_data = {status: "new",  www: "what"};

    teacher.set(new_data);
    teacher.get('info').set({name: 'new-name'});
    var expected_diff = {
      _op: '!',
      _data: $.extend(new_data, {
        id: 1,
        info: {
          _op: '!',
          _data: {id: 1, name: 'new-name'}}})};
    var diff = teacher._diff();
    ok(_.isEqual(expected_diff, diff), "change nested model should work");
  });

  test("Model: nested attribute, nested collection diff", function() {
    var Col =  OC.Collection.extend({});
    var Model = OC.Model.extend({
      students: Col,
      info: OC.Model
    });
    var teacher = new Model(nested_data);
    teacher.snapshot();     // mark a history snapshot
    var new_data = {status: "new",  www: "what"};

    teacher.set(new_data);
    teacher.get('students').add({name: 'new-student'});
    teacher.get('students').get(1).set({name: 'new-name'});
    var expected_diff = {
      _op: '!',
      _data: $.extend(new_data, {
        id: 1,
        students: [{ _op: '!',
                     _data: {id: 1, name: 'new-name'}},
                   {_op: '+',
                    _data: {name: 'new-student'}}]})};

    var diff = teacher._diff();
    ok(_.isEqual(diff, expected_diff),
       "change nested collection should work");
  });

  test("Model: nested attribute, nested collection remove diff", function() {
    var Col =  OC.Collection.extend({});
    var Model = OC.Model.extend({
      students: Col,
      info: OC.Model
    });
    var new_data = {status: "new",  www: "what"};

    var teacher = new Model(nested_data);
    teacher.snapshot();     // mark a history snapshot
    var students = teacher.get('students');
    students.add({name: 'new-student'});
    students.remove(students.get(1));
    var expected_diff = {_op: '!',
                         _data: {
                           id: 1,
                           students: [
                             {_op: '+', _data: {name: 'new-student'}},
                             {_op: '-', _data: {id: 1}}]}};
    var diff = teacher._diff();
    ok(_.isEqual(expected_diff, diff),
       "change nested collection remove should work");
  });
});
