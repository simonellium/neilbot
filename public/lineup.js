// Callables
var schedulePerformanceFn = firebase.functions().httpsCallable('schedulePerformance');
var unschedulePerformanceFn = firebase.functions().httpsCallable('unschedulePerformance');

// Global variable. Maps unscheduled pid -> performance object.
var unscheduled = {};

// Render date in MM/DD/YYYY format, from an epoc timestamp
function formatDate(time) {
    var d = new Date(time);
    let year = d.getFullYear();
    let month = (1 + d.getMonth()).toString().padStart(2, '0');
    let day = d.getDate().toString().padStart(2, '0');
    return month + '/' + day + '/' + year;
}

// Escapes html text.
function escape(text) {
    var escaped = $("<div>").text(text).html();
    return escaped;
}

// Create a banner for event.
function eventBanner(event) {
    return escape(event.title) + " " + formatDate(event.date) + ": " + escape(event.time) + ", " + escape(event.venue);
}

// Adds a spinner overlay to an element.
function addSpinner(id) {
    var spinner =
	"<div class='loader'> " +
	"  <div class='spinner'> " +
	"    <div class='double-bounce1'></div> " +
	"    <div class='double-bounce2'></div> " +
	"  </div> " +
	"</div>";
    $("#" + id).prepend(spinner);
}

// Removes spinner overlay to an element.
function removeSpinner(id) {
    $("#" + id).find(".loader").remove();
}

// Decorate performance title
function performanceTitle(performance) {
    return (performance.user !== undefined && performance.user.name ?
	    escape(performance.user.name) + " - "
	    : "") +
	performance.name;
}

// Renders pieces from a performance
function renderPieces(performance) {
    var pieces = "";
    for (var i = 0; i < performance.pieces.length; ++i) {
	var piece = performance.pieces[i];
	if (i > 0) pieces += "; ";
	pieces += escape(piece.title) + ", by ";
	pieces += escape(piece.composer);
    }
    return pieces;
}

// Renders performers from a performance
function renderPerformers(performance) {
    var performers = "";
    for (var i = 0; i < performance.performers.length; ++i) {
	var performer = performance.performers[i];
	if (i > 0) performers += ", ";
	performers += escape(performer.name) + " (" + escape(performer.instrument) + ") ";
    }
    return performers;
}

// ID of performance preview div.
function previewId(eid) {
    return "event-preview-" + eid;
}

// ID of performance schedule dropdown.
function dropdownId(eid) {
    return "event-dropdown-" + eid;
}

// ID of schedule dropdown item
function scheduleId(pid, eid, uid) {
    return "schedule-" + pid + "-" + eid + "-" + uid;
}

// ID of unschedule button.
function unscheduleId(pid, eid, uid) {
    return "unschedule-" + pid + "-" + eid + "-" + uid;
}

// ID of confirm schedule button.
function confirmScheduleId(pid, eid, uid) {
    return "confirmschedule-" + pid + "-" + eid + "-" + uid;
}

// Return the schedule/unschedule id's component pid and eid in an array.
function parseScheduleId(id) {
    var v = id.split("-");
    v.shift();
    return v;
}

function renderLineup(events, performances, users, loggedInUid,
		      displayId, uiRefresher) {
    var $display_div = $('#' + displayId);
    $display_div.unbind( "click" );
    
    // Enhance performance with user.
    if (users) {
	var userMap = new Map();
	for (var uid in users) {
	    userMap.set(uid, users[uid]);
	}
	for (var pid in performances) {
	    if (userMap.has(performances[pid].uid)) {
		performances[pid].user = userMap.get(performances[pid].uid);
	    }
	}
    }
    
    // Enhance each performance with its pid.
    for (var pid in performances) {
	performances[pid].pid = pid;
    }
    
    // Enhance each event with a lineup.
    for (var eid in events) {
	events[eid].lineup = [];
    }

    // Sort performances into the events' lineups.
    unscheduled = {};
    for (var pid in performances) {
	var performance = performances[pid];
	if (performance.eid === "") {
	    unscheduled[pid] = performance;
	} else if (events[performance.eid] !== undefined &&
		   events[performance.eid]) {
	    events[performance.eid].lineup.push(performance);
	}
    }

    // Enhance each event with remaining time.
    for (var eid in events) {
	var event = events[eid];
	var remaining_time = event.total_time;
	event.lineup.forEach(function(performance) {
	    performance.pieces.forEach(function(piece) {
		remaining_time -= piece.duration;
	    });
	});
	events[eid].remaining_time = remaining_time;
    }

    //console.log('Got event list: ', JSON.stringify(events));
    //console.log('Got unscheduled performances list: ', JSON.stringify(unscheduled));

    // Rendering.
    for (var eid in events) {
	var event = events[eid];
	
	// Accordion controls
	var headingId = "lineup-heading-" + eid;
	var collapseId = "lineup-collapse-" + eid;
	var contentId = "lineup-content-" + eid;
	var buttonId = "lineup-button-" + eid;
	var lineupClass = event.order.length == 0 ? "dark" : "success";
	var display =
	    "<div class='card' style=margin-top:20px>" +
	    "  <div class='class-header' id='" + headingId + "'>" +
	    "  <h2 class='mb-0'>" +
	    "    <button class='btn btn-outline-" + lineupClass + " btn-block text-center' type='button' data-toggle='collapse' data-target='#" + collapseId + "' aria-expanded='true' aria-controls='" + collapseId + "' id='" + buttonId + "'>" +
	    "      " + eventBanner(event) + 
	    "    </button>" +
	    "  </h2>" +
	    "  </div> <!-- card header -->" +
	    "  <div class='collapse' id='" + collapseId + "' aria-labelledby='" + headingId + "' data-parent='#" + displayId + "' >" +
	    "    <div class='card-body' id='" + contentId + "'></div>" +
	    "  </div>" +
	    "</div>";
	$display_div.append(display);

	// Fill content
	$content_div = $('#' + contentId);
	
	// Lineup details.
	var $details_div = $('<div>');
	var details = "" +
	    "<div>Date: <span class='font-weight-bold'>" + formatDate(event.date) + "</span></div>" +
	    "<div>Time: <span class='font-weight-bold'>" + escape(event.time)  + "</span></div>" +
	    "<div>Venue: <span class='font-weight-bold'>" + escape(event.venue) + "</span></div>" +
	    "<small class='form-text text-muted'>Remaining time: " + event.remaining_time + " minutes.</small> " +
	    (event.exempt ? "<small class='form-text text-muted'>Performances scheduled at this event do not count toward your maximum yearly performance limit.</small> " : "") +
	    "<p></p>";
	var lineup = "";
	
	event.lineup.forEach(function(performance) {
	    var pieces = renderPieces(performance);
	    var performers = renderPerformers(performance);
	    var duration = 0;
	    performance.pieces.forEach(function (p)  {
		duration += p.duration;
	    });
	    var canUnschedule = false;
	    if (users) {
		// admin page passes users in.
		canUnschedule = true;
	    } else {
		canUnschedule = performance.uid == loggedInUid;
	    }

	    lineup += "<div>" +
		"  <span class='font-weight-bold' data-toggle='tooltip' data-placement='top' title='" + duration + " mins'>" + pieces + "</span>" +
		"  <span class='font-weight-normal'>" + performers + "</span>" +
	        (!canUnschedule ? "" : "  <small class='text-muted'> <input type='button' class='btn btn-sm btn-circle btn-danger" + " unschedule-button' value='' id='" + unscheduleId(performance.pid, eid, performance.uid) + "'>Unschedule</small>") +
		"</div>";
	});
	details += lineup === "" ? "No performances scheduled yet." : "<div>" + lineup + "</div>";
	$details_div.append(details);
	$content_div.append($details_div);

	// Scheduling dropdown and preview area.
	$content_div.append('<hr>');
	select = "<div class='dropdown'><button class='btn btn-outline-primary dropdown-toggle' type='button' id='" + dropdownId(eid) + "' data-toggle='dropdown' aria-haspopup='true' aria-expanded='false'>Select a performance</button>";
	select += "<div class='dropdown-menu' aria-labelledby='" + dropdownId(eid) + "'>";
	for (var pid in unscheduled) {
	    select += "<a class='dropdown-item performance-dropdown-item' id='" + scheduleId(pid, eid, unscheduled[pid].uid) + "'>" + performanceTitle(unscheduled[pid]) + "</a>";
	}
	select += "</div>";
	select += "</div>";
	select += "<div id='" + previewId(eid) + "' style='margin-top:10px'></div>";
	$content_div.append(select);

	// Mailing list.
	if (users) {
	    $content_div.append('<hr>');
	    var mailing_list =
		"<div>" +
		"  <span class='font-weight-bold'>Mailing list</span>: " +
		event.lineup.map((performance) => {
		    var emails =
			performance.performers.map((performer) => {
			    return escape(performer.email);
			}).join(", ");
		    if (users[performance.uid] !== undefined) {
			emails += ", " + escape(users[performance.uid].email);
		    }
		    var names =
			performance.performers.map((performer) => {
			    return escape(performer.name);
			}).join(", ");
		    return "<span data-toggle='tooltip' data-placement='top' title='" + names + "'>" + emails + "</span>";
		}).join(", ") +
		"</div>";
	    $content_div.append(mailing_list);
	}

    }

    // Install handler for performance-dropdown-item class.
    $display_div.on("click", ".performance-dropdown-item", function(event) {
	// Extract the pid, eid, and uid from the id, fill up preview div, and
	// install a button in preview div to schedule.
	let[pid, eid, uid] = parseScheduleId($(this).attr('id'));
	$preview_div = $('#' + previewId(eid));
	var performance = unscheduled[pid];
	var preview = "";
	if (performance.pieces.length == 0) {
	    preview += "Add one or more pieces to this performance before it can be scheduled.";
	} else if (performance.performers.length == 0) {
	    preview += "Add one or more performers to this performance before it can be scheduled.";
	} else {
	    var pieces = renderPieces(performance);
	    var performers = renderPerformers(performance);
	    var duration = 0;
	    performance.pieces.forEach(function (p)  {
		duration += p.duration;
	    });
	    preview +=
		" <span class='font-weight-bold' data-toggle='tooltip' data-placement='top' title='" + duration + " mins'>" + pieces + "</span>" +
		" <span class='font-weight-normal'> - " + performers + "</span>" +
		" <button class='btn btn-circle btn-danger" + " schedule-button' value='' id='" + confirmScheduleId(pid, eid, uid) + "'>Schedule</button>";
	}
	$preview_div.empty();
	$preview_div.append(preview);
    });

    // Install handler for schedule-button class (was added dynamically.)
    $display_div.on("click", ".schedule-button", function(event) {
	let[pid, eid, uid] = parseScheduleId($(this).attr('id'));
	if (confirm("Schedule the performance?")) {
	    addSpinner(displayId); // show a spinner.
	    schedulePerformanceFn({pid: pid, eid: eid, uid: uid})
		.then((result) => {
		    removeSpinner(displayId); // remove the spinner.
		    if (result.data.error !== undefined) {
			alert("Cannot schedule the performance: " +
			      result.data.error);
			return;
		    }
		    alert("Scheduled the performance. Please check that your performance is added to the correct program. We will send you a reminder e-mail when the event program is announced.");
		    console.log("scheduled: ", JSON.stringify(result.data));
		    uiRefresher();
		}).catch(function(error) {
		    removeSpinner(displayId); // remove the spinner.
		    alert("Error scheduling the performance: " + error);
		    console.log("Error scheduling the performance: ", error);
		});
	}
    });
    
    // Install handler for unschedule-button class (was added dynamically.)
    $display_div.on("click", ".unschedule-button", function(event) {
	let[pid, eid, uid] = parseScheduleId($(this).attr('id'));
	if (confirm("Unschedule this performance?")) {
	    addSpinner(displayId); // show a spinner.
	    unschedulePerformanceFn({pid: pid, eid: eid, uid: uid})
		.then((result) => {
		    removeSpinner(displayId); // remove the spinner.
		    if (result.data.error !== undefined) {
			alert("Cannot unschedule the performance: " +
			      result.data.error);
			return;
		    }
		    alert("Unscheduled the performance. Please check that your performance is removed from the correct program.");
		    console.log("unscheduled: ", JSON.stringify(result.data));
		    uiRefresher();
		}).catch(function(error) {
		    removeSpinner(displayId); // remove the spinner.
		    alert("Error unscheduling the performance: " + error);
		    console.log("Error unscheduling the performance: ", error);
		});
	}
    });

    removeSpinner(displayId); // remove the spinner added in lineup().
}

// Event lister: function which takes a call back, and when called, sends an
// associative array mapping eid -> event object to the callback.
// Performance lister: function which takes an events filter list and a
// callback, which when called, sends an associative array mapping pid ->
// performance object to the callback, where the performance objects are listed
// with the events filter. If the performance object has empty eid, then it is
// eligible for scheduling.
// User lister: function which takes a call back, and when called, sends an
// associative array mapping uid -> user object to the callback. If omitted,
// does not decorate performance with user name and do not show the mailing
// list.
// Logged-in Uid: Uid of logged-in user.
// Display ID: a div to show the event lineup.
// RefreshUI: A function which will be called when the lineup is changed,
// for refreshing the UI.
function lineup(eventsLister, performanceLister, userLister, loggedInUid,
		displayId, uiRefresher) {
    $('#' + displayId).empty();
    addSpinner(displayId); // show a spinner.
    eventsLister((events) => {
	//console.log('Got event list: ', JSON.stringify(events));
	var e = [];
	for (var eid in events) { e.push(eid); }
	performanceLister(e, (performances) => {
	    //console.log('Got performance list: ', JSON.stringify(performances));
	    if (userLister) {
		userLister((users) => {
		    //console.log('Got user list: ', JSON.stringify(users));
		    renderLineup(events, performances, users, loggedInUid,
				 displayId, uiRefresher);
		});
	    } else {
		renderLineup(events, performances, null, loggedInUid,
			     displayId, uiRefresher);
	    }
	});
    });
}
