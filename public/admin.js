
// Auth providers.
var google_auth_provider = new firebase.auth.GoogleAuthProvider();
var facebook_auth_provider = new firebase.auth.FacebookAuthProvider();
// Add Apple???

// functions
//firebase.functions().useEmulator("localhost", 5001);//@@@
var addEventFn = firebase.functions().httpsCallable('addEvent');
var listEventFn = firebase.functions().httpsCallable('listEvent');
var setEventFn = firebase.functions().httpsCallable('setEvent');
var deleteEventFn = firebase.functions().httpsCallable('deleteEvent');
var listPerformanceFn = firebase.functions().httpsCallable('listPerformance');
var listUserFn = firebase.functions().httpsCallable('listUser');

// Global variable.
var loggedInUserId;

// Reverse formatDate.
function parseDate(input) {
    var date_regex = /^(0[1-9]|1[0-2])\/(0[1-9]|1\d|2\d|3[01])\/(19|20)\d{2}$/;
    if (!(date_regex.test(input))) {
	return -1;
    }
    return new Date(input).getTime();
}

// Helpers
function dateId(eid) { return "event-date-" + eid; }
function timeId(eid) { return "event-time-" + eid; }
function titleId(eid) { return "event-title-" + eid; }
function venueId(eid) { return "event-venue-" + eid; }
function totalDurationId(eid) { return "event-total-duration-" + eid; }
function maxDurationId(eid) { return "event-max-duration-" + eid; }
function minDurationId(eid) { return "event-min-duration-" + eid; }
function lockedId(eid) { return "event-locked-button-" + eid; }
function exemptId(eid) { return "event-exempt-button-" + eid; }
function editId(eid) { return "event-edit-button-" + eid; }
function saveId(eid) { return "event-save-button-" + eid; }
function deleteId(eid) { return "event-delete-button-" + eid; }

// Handlers
function editEvent(eid) {
    $('#' + dateId(eid)).prop('disabled', false);
    $('#' + timeId(eid)).prop('disabled', false);
    $('#' + titleId(eid)).prop('disabled', false);
    $('#' + venueId(eid)).prop('disabled', false);
    $('#' + totalDurationId(eid)).prop('disabled', false);
    $('#' + maxDurationId(eid)).prop('disabled', false);
    $('#' + minDurationId(eid)).prop('disabled', false);
    $('#' + lockedId(eid)).prop('disabled', false);
    $('#' + exemptId(eid)).prop('disabled', false);
    $('#' + saveId(eid)).show();
    $('#' + deleteId(eid)).show();
    $('#' + editId(eid)).hide();
}
function saveEvent(eid) {
    var eventdate = parseDate($('#' + dateId(eid)).val());
    if (eventdate <= 0) {
	alert("Invalid date format. Use MM/DD/YYYY");
	return;
    }
    var totaltime = Number($('#' + totalDurationId(eid)).val());
    var maxtime = Number($('#' + maxDurationId(eid)).val());
    var mintime = Number($('#' + minDurationId(eid)).val());
    if (Number.isNaN(totaltime) || Number.isNaN(maxtime) || Number.isNaN(mintime)) {
	alert("Enter a number (in minutes) for durations");
	return;
    }
    var event = {
	"eid": eid,
	"date": eventdate,
	"time": $('#' + timeId(eid)).val(),
	"title": $('#' + titleId(eid)).val(),
	"venue": $('#' + venueId(eid)).val(),
	"total_time": totaltime,
	"max_time": maxtime,
	"min_time": mintime,
	"order": $('#' + lockedId(eid)).prop('checked') ? ["dummy"] : [],
	"exempt": $('#' + exemptId(eid)).prop('checked'),
    }
    console.log('Saving event:', JSON.stringify(event));
    setEventFn(event).then((result) => {
	if (result.data.error !== undefined) {
	    alert("Cannot add the event: " + result.data.error);
	    return;
	}
	console.log('Saved event: ', JSON.stringify(result));
	// Update UI.
	$("#event-button-" + eid).html(eventBanner(event));
	$("#event-button-" + eid).removeClass(['btn-outline-success', 'btn-outline-dark']);
	$("#event-button-" + eid).addClass(event.order.length > 0 ? 'btn-outline-success' : 'btn-outline-dark');
	refreshLineup()
    });
    $('#' + dateId(eid)).prop('disabled', true);
    $('#' + timeId(eid)).prop('disabled', true);
    $('#' + titleId(eid)).prop('disabled', true);
    $('#' + venueId(eid)).prop('disabled', true);
    $('#' + totalDurationId(eid)).prop('disabled', true);
    $('#' + maxDurationId(eid)).prop('disabled', true);
    $('#' + minDurationId(eid)).prop('disabled', true);
    $('#' + lockedId(eid)).prop('disabled', true);
    $('#' + exemptId(eid)).prop('disabled', true);
    $('#' + saveId(eid)).hide();
    $('#' + deleteId(eid)).hide();
    $('#' + editId(eid)).show();
}
function deleteEvent(eid) {
    if (confirm("Delete the event?")) {
	deleteEventFn({eid: eid}).then((result) => {
	    if (result.data.error !== undefined) {
		alert("Cannot delete the event: " + result.data.error);
		return;
	    }
	    alert('Deleted event.');
	    // Update UI
	    refreshEventList();
	}).catch(function(error) {
	    alert("cannot delete event: " + error);
	    console.log("cannot delete event: ", error);
	});
    }
}
function installHandlers(eid) {
    $('#' + editId(eid)).on('click', function() {
	editEvent(eid);
    });
    $('#' + saveId(eid)).on('click', function() {
	saveEvent(eid);
    });
    $('#' + deleteId(eid)).on('click', function() {
	deleteEvent(eid);
    });
}

// Refreshes the event list by reading from the database.
function refreshEventList() {
    $("#eventlist").empty(); //<-- maybe show a spinner???
    // Cut off of 0 if showing past events, otherwise, cutoff at now.
    var cutoff = $("#show-old-event-checkbox").prop('checked') ? 0 : (new Date()).getTime();
    listEventFn({cutoff: cutoff}).then((result) => {
	$("#eventlist").empty();
	var $events_div = $('#eventlist');
	//console.log('Got event list: ', JSON.stringify(result));
	for (var key in result.data) {
	    var eid = key;
	    var event = result.data[key];
	    //console.log('rendering event id: ', eid);

	    // Fill in the skeleton.
	    
	    // Accordion controls
	    var headingId = "event-heading-" + eid;
	    var collapseId = "event-collapse-" + eid;
	    var contentId = "event-content-" + eid;
	    var buttonId = "event-button-" + eid;
	    var eventClass = (event.order.length > 0) ? "success" : "dark";
	    var display =
		"<div class='card' style=margin-top:20px>" +
		"  <div class='class-header' id='" + headingId + "'>" +
		"  <h2 class='mb-0'>" +
		"    <button class='btn btn-outline-" + eventClass + " btn-block text-center' type='button' data-toggle='collapse' data-target='#" + collapseId + "' aria-expanded='true' aria-controls='" + collapseId + "' id='" + buttonId + "'>" +
		"      " + eventBanner(event) +
		"    </button>" +
		"  </h2>" +
		"  </div> <!-- card header -->" +
		"  <div class='collapse' id='" + collapseId + "' aria-labelledby='" + headingId + "' data-parent='#eventlist' >" +
		"    <div class='card-body' id='" + contentId + "'></div>" +
		"  </div>" +
		"</div>";
	    $events_div.append(display);

	    // Event input form.
	    var form =
		"<form>" +
		"  <div class='form-group row'>" +
		"    <label for='" + dateId(eid) +"' class='col-sm-3 col-form-label'>Date</label>" +
		"    <div class='col-sm-9'><input type='text' class='form-control is-disabled' id='" + dateId(eid) + "' disabled></input></div>" +
		"  </div>" +
		"  <div class='form-group row'>" +
		"    <label for='" + timeId(eid) +"' class='col-sm-3 col-form-label'>Time</label>" +
		"    <div class='col-sm-9'><input type='text' class='form-control is-disabled' id='" + timeId(eid) + "' disabled></input></div>" +
		"  </div>" +
		"  <div class='form-group row'>" +
		"    <label for='" + titleId(eid) +"' class='col-sm-3 col-form-label'>Title</label>" +
		"    <div class='col-sm-9'><input type='text' class='form-control is-disabled' id='" + titleId(eid) + "' disabled></input></div>" +
		"  </div>" +
		"  <div class='form-group row'>" +
		"    <label for='" + venueId(eid) +"' class='col-sm-3 col-form-label'>Venue</label>" +
		"    <div class='col-sm-9'><input type='text' class='form-control is-disabled' id='" + venueId(eid) + "' disabled></input></div>" +
		"  </div>" +
		"  <div class='form-group row'>" +
		"    <label for='" + totalDurationId(eid) +"' class='col-sm-3 col-form-label'>Total Duration</label>" +
		"    <div class='col-sm-9'><input type='text' class='form-control is-disabled' id='" + totalDurationId(eid) + "' disabled></input></div>" +
		"  </div>" +
		"  <div class='form-group row'>" +
		"    <label for='" + maxDurationId(eid) +"' class='col-sm-3 col-form-label'>Max Duration</label>" +
		"    <div class='col-sm-9'><input type='text' class='form-control is-disabled' id='" + maxDurationId(eid) + "' disabled></input></div>" +
		"  </div>" +
		"  <div class='form-group row'>" +
		"    <label for='" + minDurationId(eid) +"' class='col-sm-3 col-form-label'>Min Duration</label>" +
		"    <div class='col-sm-9'><input type='text' class='form-control is-disabled' id='" + minDurationId(eid) + "' disabled></input></div>" +
		"  </div>" +
		"  <div class='form-group row'>" +
		"    <label for='" + lockedId(eid) +"' class='col-sm-3 col-form-label'>Locked?</label>" +
		"    <div class='col-sm-9'><input type='checkbox' class='form-check-input is-disabled' style='margin-left:5px' id='" + lockedId(eid) + "' disabled></input></div>" +
		"  </div>" +
		"  <div class='form-group row'>" +
		"    <label for='" + exemptId(eid) +"' class='col-sm-3 col-form-label'>Exempt?</label>" +
		"    <div class='col-sm-9'><input type='checkbox' class='form-check-input is-disabled' style='margin-left:5px' id='" + exemptId(eid) + "' disabled></input></div>" +
		"  </div>" +
		"</form>"
		"";
	    var $content_div = $("#" + contentId);
	    $content_div.append(form);

	    // Fill in the data.
	    $('#' + dateId(eid)).val(formatDate(event.date));
	    $('#' + timeId(eid)).val(event.time);
	    $('#' + titleId(eid)).val(escape(event.title));
	    $('#' + venueId(eid)).val(escape(event.venue));
	    $('#' + totalDurationId(eid)).val(event.total_time);
	    $('#' + maxDurationId(eid)).val(event.max_time);
	    $('#' + minDurationId(eid)).val(event.min_time);
	    $('#' + lockedId(eid)).prop('checked', (event.order.length > 0));
	    $('#' + exemptId(eid)).prop('checked', event.exempt);

	    // Event controls.
	    var controls =
		"<div>" +
		"  <input type='button' class='btn btn-sm btn-outline-primary ' id='" + editId(eid) + "' value='Edit' />" +
		"  <input type='button' class='btn btn-sm btn-outline-primary ' id='" + saveId(eid) + "' value='Save' />" +
		"  <input type='button' class='btn btn-sm btn-outline-primary ' id='" + deleteId(eid) + "' value='Delete' />" +
		"</div>";
	    $content_div.append(controls);
	    $('#' + saveId(eid)).hide();
	    $('#' + deleteId(eid)).hide();
	    installHandlers(eid);
	}
    });
}

function refreshLineup() {
    // Cut off of 0 if showing past events, otherwise, cutoff at now.
    var cutoff = $("#show-old-lineup-checkbox").prop('checked') ? 0 : (new Date()).getTime();
    lineup(
	// Event lister.
	function(callback) {
	    listEventFn({cutoff: cutoff}).then((result) => {
		callback(result.data);
	    }).catch(function(error) {
		alert("cannot list events: " + error);
		console.log("cannot list events: ", error);
	    });
	},
	// Performance lister.
	function(e, callback) {
	    listPerformanceFn({events: e, allUsers: true}).then((result) => {
		callback(result.data);
	    }).catch(function(error) {
		alert("cannot list performances: " + error);
		console.log("cannot list performances: ", error);
	    });
	},
	// User lister.
	function(callback) {
	    listUserFn().then((result) => {
		callback(result.data);
	    }).catch(function(error) {
		alert("cannot list users: " + error);
		console.log("cannot list users, " + error);
	    });
	},
	// Current user.
	loggedInUserId,
	// display Id.
	"lineup",
	// UI Refresher.
	function() {
	    refreshEventList();
	    refreshLineup();
	}
    );
}

// Login
function login(auth_provider) {
    firebase.auth().signInWithPopup(auth_provider).then(function(result) {
	var user = result.user;
	// alert("signed in as " + user.displayName + ", " +
	//       user.email + ", " + user.uid);
	// Logged in. Initialize the database references.
	loggedInUserId = user.uid
	
	// Update the greeting.
	$('#greetingname').text(user.displayName);
	
	$('#login').hide();
	$('#main').show();

	// Add Event button.
	$('#add-event').on('click', function() {
	    var input = prompt("Enter event date (MM/DD/YYYY)", "");
	    var eventdate = parseDate(input);
	    if (eventdate <= 0) {
		alert("Invalid date format.");
		return;
	    }
	    var eventtitle = prompt("Enter event title", "");
	    var event = {
		"date": eventdate,
		"time": "",
		"title": eventtitle,
		"venue": "",
		"total_time": 0,
		"max_time": 0,
		"min_time": 0,
		"order": [],  // initially unlocked.
		"exempt": false,
	    }
	    console.log('Adding event:', JSON.stringify(event));
	    addEventFn(event).then((result) => {
		if (result.data.error !== undefined) {
		    alert("Cannot add the event: " + result.data.error);
		    return;
		}
		console.log('Added event: ', JSON.stringify(result));
		// Refresh the event panel to show new event.
		refreshEventList();
	    });
	});
	$('#show-old-event-checkbox').on('click', function() {
	    refreshEventList();
	});
	$('#show-old-lineup-checkbox').on('click', function() {
	    refreshLineup();
	});
	
	// Initialize UI.
	refreshEventList();
	refreshLineup();
    }).catch(function(error) {
	// Handle Errors here.
	alert("error: " + error.message);
	console.log("error: ", error.message);
    });
}

$(document).ready(function(){
     // Login
    $('#facebook-login').on('click', function() {
	login(facebook_auth_provider);
    });
    $('#google-login').on('click', function() {
	login(google_auth_provider);
    });
});
