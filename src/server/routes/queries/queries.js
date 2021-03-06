var knex = require('../../db/knex');
var bcrypt = require('bcrypt');

function Events() {
  return knex('events').where('deleted', false);
}

function Tickets() {
  return knex('tickets').where('deleted', false);
}

function Students() {
  return knex('students').where('deleted', false);
}

function Guests() {
  return knex('guests').where('deleted', false);
}

function Teachers() {
  return knex('teachers').where('deleted', false);
}

function hashing(password) {
  return bcrypt.hashSync(password, 10);
}



function getAllEvents(school_id) {
  // Query for school name?
  return knex.raw('select events.id, events.name, events.event_date, ' +
  'school_id, description, address, count(tickets.id), max_tickets, ' +
  'events.is_public ' +
  'from events left join tickets on tickets.event_id = events.id ' +
  'where events.deleted = false AND school_id = ' + school_id +
  'group by events.id, events.name, school_id, description, address, ' +
  'max_tickets order by events.event_date')
  .then(function(results) {
    return results.rows;
  })
  .catch(function(error) {
    console.log('getAllEvents Error: ' + error);
  });
}

function addGuest(params) {
  return Guests().insert(params).returning('id');
}

function getStudentsByEvent(searchFor) {
  var queryString =
  'select '
  + 'students.id, '
  + 'students.student_id, '
  + 'students.first_name, '
  + 'students.middle_name, '
  + 'students.last_name, '
  + 'students.grade, '
  + 'tickets.id as ticket_number, '
  + 'tickets.sold_timestamp, '
  + 'tickets.redeemed_on '
  + 'from students '
  + 'inner join tickets on tickets.student_id = students.id '
  + 'inner join events on tickets.event_id = events.id '
  + 'where tickets.deleted = false and events.id = ' + searchFor.eventId;
  if (searchFor.matcher) {
    queryString +=
    ' AND (LOWER(students.student_id) like LOWER(\'' +
      searchFor.matcher + '%\')'
    + ' OR LOWER(students.first_name) like LOWER(\'' +
      searchFor.matcher + '%\')'
    + ' OR LOWER(students.last_name) like LOWER(\'' +
      searchFor.matcher + '%\')'
    if (!isNaN(Number(searchFor.matcher))) {
      queryString += ' OR tickets.id = ' +
      Number(searchFor.matcher) + ')';
    } else {
      queryString += ')';
    }
  }
  queryString += ' order by students.last_name, tickets.id ';
  if (searchFor.limit) {
    queryString += 'limit ' + searchFor.limit;
  }
  return knex.raw(queryString)
  .then(function(students) {
    return getGuestsByEventGroupByStudentId(searchFor.eventId)
    .then(function(guestsObject) {
      var studentsIdsWithGuests = Object.keys(guestsObject);
      var count = -1;
      var counter = 0;
      var returner = [];
      students.rows.forEach(function(student) {
        if (studentsIdsWithGuests.indexOf(student.id + '') != -1) {
          count++;
          if (guestsObject[student.id + ''][count - 1] && count > 0) {
            student['guest_first_name'] =
              guestsObject[student.id + ''][count - 1][0];
            student['guest_last_name'] =
              guestsObject[student.id + ''][count - 1][1];
            student['guest_id'] =
              guestsObject[student.id + ''][count - 1][2];
            returner.push(student)
          } else {
            returner.push(student);
          }
        } else {
          returner.push(student);
          count = -1;
        }
      });
      return returner;
    });
  });
}

function getGuestsByEventGroupByStudentId(eventId) {
  var queryString =
  'select guests.first_name, guests.last_name, guests.id as guest_id, ' +
    'students.id as student_id '
  + 'from guests '
  + 'inner join students on guests.student_id = students.id '
  + 'inner join tickets on tickets.student_id = students.id '
  + 'inner join events on events.id = tickets.event_id '
  + 'where guests.deleted = false and events.id = ' + eventId
  + ' group by guests.id, students.id';
  return knex.raw(queryString).then(function(results) {
    var returner = {
    };
    results.rows.forEach(function(row) {
      if (returner[row.student_id]) {
        returner[row.student_id].push([row.first_name, row.last_name,
          row.guest_id,]);
      } else {
        returner[row.student_id] = [[row.first_name, row.last_name,
          row.guest_id,],];
      }
    });
    return returner;
  });
}

function addEvent(body, id) {
  return Events().insert(body)
  .catch(function(error) {
    console.log(error);
  });
}

function editEvent(body, id) {
  return Events().where('id', id).update(body, 'id').then(function(data) {
    return data[0];
  });
}

function deleteEvent(id) {
  return Events().where('id', id).update({
    deleted: true
  }, '*').then(function(data) {
    return data[0];
  });
}

function getEventById(id) {
  return Events().where('id', id).then(function(data) {
    return data;
  });
}

function getStudentInfo(id) {
  return Students().where('student_id', id);
}

function getTickets(params) {
  return Tickets().where(params)
  .then(function(tickets) {
    return tickets;
  })
  .catch(function(error) {
    console.log(error);
  });
}

function getTicketNum(studentId, eventId) {
  return Tickets().where({
    student_id: studentId,
    event_id: eventId,
  }).then(function(result) {
    return result.length;
  });
}

function sellTicket(studentId, eventId) {
  return Students().where('id', studentId)
  .then(function(student) {
    return Tickets().insert({
      student_id:  student[0].id,
      event_id: eventId,
      sold_timestamp: 'now()',
    })
    .then(function() {
      return Tickets().where({
        student_id: studentId,
        event_id: eventId,
      });
    });
  })
    .catch(function(error) {
      console.log(error);
    });
}

function redeemTicket(ticketNumber) {
  return Tickets().where({id: ticketNumber}).update({
    redeemed_on: 'now()',
  })
}

function deleteTicket(studentId, ticketId) {
  return Tickets().where({student_id: studentId})
  .then(function(tickets) {
    for (var i = 0; i < tickets.length; i++) {
      var ticket = tickets[i];
      if (ticket.id == ticketId) {
        if (i === 0) {
          return Tickets().where({student_id: studentId})
            .update({
              deleted: true,
              deleted_date: 'now()',
            });
        }
        return Tickets().where({id: ticketId}).update({
          deleted: true,
          deleted_date: 'now()',
        });
      }
    }
  })
}

function ticketCount(params) {
  return Tickets().where(params).count('id');
}

function getGuests(params) {
  return Guests().where(params);
}

function addStudent(params) {
  return Students().insert(params).returning('id');
}

function addGuest(params) {
  return Guests().insert(params).returning('id');
}

function editGuest(params, id) {
  return Guests().where('id', id).update({
    first_name: params.first_name,
    last_name: params.last_name,
  }, 'id').then(function(data) {
    return data;
  });
}


function addTeacher(body, id) {
  return Teachers().where('email_address', body.email).then(function(data) {
    console.log('data: ', data);
    if (data.length) {
      return Promise.reject('Email already exists');
    }
    var hashedPassword = hashing(body.password);
    return Teachers().insert({
      email_address: body.email,
      password: hashedPassword,
      teacher_id: body.teacher_id,
      first_name: body.first_name,
      last_name: body.last_name,
      school_id: id,
    });
  });
}

module.exports = {
  getAllEvents: getAllEvents,
  addEvent: addEvent,
  sellTicket: sellTicket,
  getStudentInfo: getStudentInfo,
  getTicketNum: getTicketNum,
  addGuest: addGuest,
  getGuests: getGuests,
  addStudent: addStudent,
  ticketCount: ticketCount,
  getStudentsByEvent: getStudentsByEvent,
  editGuest: editGuest,
  getEventById: getEventById,
  editEvent: editEvent,
  addTeacher: addTeacher,
  redeemTicket: redeemTicket,
  hashing: hashing,
  getTickets: getTickets,
  deleteTicket: deleteTicket,
  deleteEvent: deleteEvent,
};
