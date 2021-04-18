
// Auth providers.
var google_auth_provider = new firebase.auth.GoogleAuthProvider();
var facebook_auth_provider = new firebase.auth.FacebookAuthProvider();
// Add Apple???

// functions
//firebase.functions().useEmulator("localhost", 5001);
var setUserFn = firebase.functions().httpsCallable('setUser');
var getUserFn = firebase.functions().httpsCallable('getUser');
var addPerformanceFn = firebase.functions().httpsCallable('addPerformance');
var listPerformanceFn = firebase.functions().httpsCallable('listPerformance');
var setPerformanceFn = firebase.functions().httpsCallable('setPerformance');
var deletePerformanceFn = firebase.functions().httpsCallable('deletePerformance');
var listEventFn = firebase.functions().httpsCallable('listEvent');

// Global variable.
var loggedInUserId;

// Helpers
function nameId(pid) { return "performance-name-" + pid; }
function piecesId(pid) { return "performance-pieces-" + pid; }
function addPiecesId(pid) { return "performance-add-pieces-" + pid; }
function performersId(pid) { return "performance-performers-" + pid; }
function addPerformersId(pid) { return "performance-add-performers-" + pid; }
function editId(pid) { return "event-edit-button-" + pid; }
function saveId(pid) { return "event-save-button-" + pid; }
function deleteId(pid) { return "event-delete-button-" + pid; }
function contentId(pid) { return "performance-content-" + pid; }

// Handlers
function editPerformance(pid) {
    $('#' + nameId(pid)).prop('disabled', false);
    $('#' + piecesId(pid)).find('input').prop('disabled', false);
    $('#' + addPiecesId(pid)).prop('disabled', false);
    $('#' + performersId(pid)).find('input').prop('disabled', false);
    $('#' + addPerformersId(pid)).prop('disabled', false);
    $('#' + saveId(pid)).show();
    $('#' + deleteId(pid)).show();
    $('#' + editId(pid)).hide();
    $('#' + addPiecesId(pid)).removeClass("btn-outline-secondary");
    $('#' + addPerformersId(pid)).removeClass("btn-outline-secondary");
    $('#' + addPiecesId(pid)).addClass("btn-primary");
    $('#' + addPerformersId(pid)).addClass("btn-primary");
    $('#' + contentId(pid)).find('.delete-button').prop('hidden', false);
}
function savePerformance(pid) {
    var name = $('#' + nameId(pid)).val();
    if (name === "") {
	alert("Please specify a name for your performance.");
	return;
    }
    var performance = {
	"name": name,
	"pid": pid,
	"performers": [],
	"pieces": [],
    };
    $('#' + performersId(pid)).children().each(function() {
	var performer = { "name": "", "instrument": "","email": "" };
	performer.name = $(this).find('.performer-name').val();
	performer.instrument = $(this).find('.performer-instrument').val();
	performer.email = $(this).find('.performer-email').val();
	performance.performers.push(performer);
    });
    $('#' + piecesId(pid)).children().each(function() {
	var composer = $(this).find('.piece-composer').val();
	var title = $(this).find('.piece-title').val();
	var duration = Number($(this).find('.piece-duration').val());
	if (Number.isNaN(duration) || duration <= 0) {
	    duration = null;
	}
	performance.pieces.push({
	    composer: composer,
	    title: title,
	    duration: duration,
	});
    });
    if (performance.performers.some((p) => { return p.name === ""; })) {
	alert("All performers must have a name.");
	return;
    }
    if (performance.performers.some((p) => { return p.instrument === ""; })) {
	alert("All performers must have an instrument.");
	return;
    }
    if (performance.pieces.some((p) => { return p.title === ""; })) {
	alert("All pieces must have a title.");
	return;
    }
    if (performance.pieces.some((p) => { return p.composer === ""; })) {
	alert("All pieces must have a composer.");
	return;
    }
    if (performance.pieces.some((p) => { return p.duration == null; })) {
	alert("All pieces must have positive duration.");
	return;
    }
    console.log('Saving performance:', JSON.stringify(performance));
    addSpinner("performancelist"); // show the spinner.
    setPerformanceFn(performance).then((result) => {
	alert('Saved performance ' + performance.name);
	console.log('Saved performance: ', JSON.stringify(result));
	removeSpinner("performancelist"); // remove the spinner.
	// Update UI.
	$("#performance-button-" + pid).html(escape(performance.name));
	// Update controls. Just undo editPerformance().    
	$('#' + nameId(pid)).prop('disabled', true);
	$('#' + piecesId(pid)).find('input').prop('disabled', true);
	$('#' + addPiecesId(pid)).prop('disabled', true);
	$('#' + performersId(pid)).find('input').prop('disabled', true);
	$('#' + addPerformersId(pid)).prop('disabled', true);
	$('#' + saveId(pid)).hide();
	$('#' + deleteId(pid)).hide();
	$('#' + editId(pid)).show();
	$('#' + addPiecesId(pid)).addClass("btn-outline-secondary");
	$('#' + addPerformersId(pid)).addClass("btn-outline-secondary");
	$('#' + addPiecesId(pid)).removeClass("btn-primary");
	$('#' + addPerformersId(pid)).removeClass("btn-primary");
	$('#' + contentId(pid)).find('.delete-button').prop('hidden', true);
	// Update the schedule.
	refreshLineup();
    }).catch((error) => {
	alert('Cannot save the performance. ' + error);
	removeSpinner("performancelist"); // remove the spinner.
	console.log('Cannot save the performance. ', error);
    });
}
function deletePerformance(pid) {
    if (confirm("Delete the performance?")) {
	addSpinner("performancelist"); // show the spinner.
	deletePerformanceFn({pid: pid}).then((result) => {
	    console.log('Deleted performance: ', JSON.stringify(result));
	    removeSpinner("performancelist"); // remove the spinner.
	    // Update UI
	    refreshPerformanceList();
	    refreshLineup();
	}).catch((error) => {
	    alert('Cannot delete the performance. ' + error);
	    removeSpinner("performancelist"); // remove the spinner.
	    console.log('Cannot save the performance. ', error);
	});
    }
}
function installHandlers(pid) {
    $('#' + addPiecesId(pid)).on('click', function() {
	addPieceSlot(pid, null);
    });
    $('#' + addPerformersId(pid)).on('click', function() {
	addPerformerSlot(pid, null);
    });
    $('#' + editId(pid)).on('click', function() {
	editPerformance(pid);
    });
    $('#' + saveId(pid)).on('click', function() {
	savePerformance(pid);
    });
    $('#' + deleteId(pid)).on('click', function() {
	deletePerformance(pid);
    });
    $("table.piece-list, table.performers-list")
	.on("click", ".ibtnDel", function (event) {
            $(this).closest("tr").remove();
	});
}

// Creates the text box for putting in a piece's composer
function composerInput() {
    return "<input type='text' class='piece-composer col-sm-12'>";
}
// Creates the text box for putting in a piece's title
function titleInput() {
    return "<input type='text' class='piece-title col-sm-12'>";
}
// Creates the text box for putting in a piece's duration
function durationInput() {
    return "<input type='text' class='piece-duration col-sm-3'>";
}
// Creates the text box for putting in a performer's name
function nameInput() {
    return "<input type='text' class='performer-name col-sm-12'>";
}
// Creates the text box for putting in a performer's instrument
function instrumentInput() {
    return "<input type='text' class='performer-instrument col-sm-12'>";
}
// Creates the text box for putting in a performer's email
function emailInput() {
    return "<input type='text' class='performer-email col-sm-12'>";
}

// Adds a piece to the performance.
function addPieceSlot(pid, piece) {
    var $piece_tbody = $('#' + piecesId(pid));
    var newRow = $("<tr>");
    var cols = "";
    cols += '<td>' + composerInput() + '</td>';
    cols += '<td>' + titleInput() + '</td>';
    cols += '<td>' + durationInput() + '</td>';
    cols += '<td><input type="button" class="ibtnDel btn btn-sm btn-danger delete-button" value="Delete"></td>';
    newRow.append(cols);
    $piece_tbody.append(newRow);
    $new_piece = $piece_tbody.children().last();

    // Pre-populate the fields here, if given, and disable.
    if (piece) {
	if (piece.composer) {
	    $new_piece.find('.piece-composer').val(piece.composer);
	}
	if (piece.title) {
	    $new_piece.find('.piece-title').val(piece.title);
	}
	if (piece.duration) {
	    $new_piece.find('.piece-duration').val(piece.duration);
	}
	$new_piece.find('.piece-composer').prop('disabled', true);
	$new_piece.find('.piece-title').prop('disabled', true);
	$new_piece.find('.piece-duration').prop('disabled', true);
	$new_piece.find('.delete-button').prop('hidden', true);
    }
}

// Adds a performer to the performance.
function addPerformerSlot(pid, performer) {
    var $performer_tbody = $('#' + performersId(pid));
    var newRow = $("<tr>");
    var cols = "";
    cols += '<td>' + nameInput() + '</td>';
    cols += '<td>' + instrumentInput() + '</td>';
    cols += '<td>' + emailInput() + '</td>';
    cols += '<td><input type="button" class="ibtnDel btn btn-sm btn-danger delete-button" value="Delete"></td>';
    newRow.append(cols);
    $performer_tbody.append(newRow);
    $new_performer = $performer_tbody.children().last();

    // Pre-populate the fields here, if given, and disable.
    if (performer) {
	if (performer.name) {
	    $new_performer.find('.performer-name').val(performer.name);
	}
	if (performer.instrument) {
	    $new_performer.find('.performer-instrument').val(performer.instrument);
	}
	if (performer.email) {
	    $new_performer.find('.performer-email').val(performer.email);
	}
	$new_performer.find('.performer-name').prop('disabled', true);
	$new_performer.find('.performer-instrument').prop('disabled', true);
	$new_performer.find('.performer-email').prop('disabled', true);
	$new_performer.find('.delete-button').prop('hidden', true);
    }
}

// Refreshes the event list by reading from the database.
function refreshPerformanceList() {
    $("#performancelist").empty();
    addSpinner("performancelist");
    var allPerformances =
	$("#show-scheduled-performances-checkbox").prop('checked');
    listPerformanceFn({events: [], allPerformances: allPerformances}).then((result) => {
	var $performances_div = $('#performancelist');
	//console.log('Got performance list: ', JSON.stringify(result));
	for (var key in result.data) {
	    var pid = key;
	    var performance = result.data[key];
	    //console.log('rendering performance id: ', pid);

	    // Fill in the skeleton.
	    
	    // Accordion controls
	    var headingId = "performance-heading-" + pid;
	    var collapseId = "performance-collapse-" + pid;
	    var buttonId = "performance-button-" + pid;
	    var performanceClass = performance.eid === '' ? "dark" : "danger";
	    var display =
		"<div class='card' style=margin-top:20px>" +
		"  <div class='class-header' id='" + headingId + "'>" +
		"  <h2 class='mb-0'>" +
		"    <button class='btn btn-outline-" + performanceClass + " btn-block text-center' type='button' data-toggle='collapse' data-target='#" + collapseId + "' aria-expanded='true' aria-controls='" + collapseId + "' id='" + buttonId + "'>" +
		"      " + escape(performance.name) + 
		"    </button>" +
		"  </h2>" +
		"  </div> <!-- card header -->" +
		"  <div class='collapse' id='" + collapseId + "' aria-labelledby='" + headingId + "' data-parent='#performancelist' >" +
		"    <div class='card-body' id='" + contentId(pid) + "'></div>" +
		"  </div>" +
		"</div>";
	    $performances_div.append(display);

	    // Performance input form.
	    var form =
		"<form>" +

		// Title
		"  <div class='form-group row'>" +
		"    <label for='" + nameId(pid) +"' class='col-sm-3 col-form-label'>Performance Name</label>" +
		"    <div class='col-sm-9'><input type='text' class='form-control is-disabled' id='" + nameId(pid) + "' disabled></input></div>" +
		"  </div>" +

		// Performers
		"  <div class='form-group row'>" +
		"    <small id='" + performersId(pid) + "-help' class='form-text text-muted'>Who are performing? Make sure to include yourself if you are performing.</small>" +
		"    <table class=' table performers-list'>" +
		"    <thead>" +
		"      <tr>" +
		"       <td>Name</td>" +
		"       <td>Instrument</td>" +
		"       <td>E-mail</td>" +
		"     </tr>" +
		"    </thead>" +
		"    <tbody id='" + performersId(pid) + "'></tbody>" +
		"    <tfoot>" +
		"      <tr>" +
		"        <td colspan='5' style='text-align: left;'>" +
                "        <input type='button' class='btn btn-sm btn-outline-secondary ' id='" + addPerformersId(pid) + "' value='Add Performer' disabled />" +
		"        </td>" +
		"      </tr>" +
		"      <tr>" +
		"      </tr>" +
		"    </tfoot>" +
		"    </table>" +
		"  </div>" +

		// Pieces
		"  <div class='form-group row'>" +
		"    <small id='" + piecesId(pid) + "-help' class='form-text text-muted'>What are they performing? </small>" +
		"    <table class=' table piece-list'>" +
		"    <thead>" +
		"      <tr>" +
		"       <td>Composer</td>" +
		"       <td>Title</td>" +
		"       <td>Duration (mins)</td>" +
		"     </tr>" +
		"    </thead>" +
		"    <tbody id='" + piecesId(pid) + "'></tbody>" +
		"    <tfoot>" +
		"      <tr>" +
		"        <td colspan='5' style='text-align: left;'>" +
                "        <input type='button' class='btn btn-sm btn-outline-secondary ' id='" + addPiecesId(pid) + "' value='Add Piece' disabled />" +
		"        </td>" +
		"      </tr>" +
		"      <tr>" +
		"      </tr>" +
		"    </tfoot>" +
		"    </table>" +
		"  </div>" +

		"</form>"
		"";
	    var $content_div = $("#" + contentId(pid));
	    $content_div.append(form);
	    
	    // Fill in the data.
	    $('#' + nameId(pid)).val(performance.name);
	    performance.pieces.forEach(function(piece) {
		addPieceSlot(pid, piece);
	    });
	    performance.performers.forEach(function(performer) {
		addPerformerSlot(pid, performer);
	    });

	    // Controls. Only add if performance is not scheduled.
	    if (performance.eid === "") {
		var controls =
		    "<div>" +
		    "  <input type='button' class='btn btn-md btn-outline-primary ' id='" + editId(pid) + "' value='Edit' />" +
		    "  <input type='button' class='btn btn-md btn-outline-primary ' id='" + saveId(pid) + "' value='Save' />" +
		    "  <input type='button' class='btn btn-md btn-outline-primary ' id='" + deleteId(pid) + "' value='Delete' />" +
		    "</div>";
		$content_div.append(controls);
		$('#' + saveId(pid)).hide();
		$('#' + deleteId(pid)).hide();
		installHandlers(pid);
	    }
	}
    }).finally(() => {
	removeSpinner("performancelist");
    });
}

function refreshLineup() {
    lineup(
	// Event lister.
	function(callback) {
	    listEventFn({cutoff: (new Date()).getTime()}).then((result) => {
		callback(result.data);
	    }).catch(function(error) {
		alert("cannot list events: " + error);
		console.log("cannot list events: ", error);
	    });
	},
	// Performance lister.
	function(e, callback) {
	    listPerformanceFn({events: e}).then((result) => {
		callback(result.data);
	    }).catch(function(error) {
		alert("cannot list performances: " + error);
		console.log("cannot list performances: ", error);
	    });
	},
	// User lister.
	null,
	// Current user.
	loggedInUserId,
	// display Id.
	"scheduling",
	// UI Refresher.
	function() {
	    refreshPerformanceList();
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

	// Update profile section.
	getUserFn().then((result) => {
	    //console.log('Fetched user: ', JSON.stringify(result));
	    if (result.data) {
		$('#displayname').val(result.data.name);
		$('#email').val(result.data.email);
	    }
	});
	
	// Add Performance button.
	$('#add-performance').on('click', function() {
	    var name = prompt("Enter a name to identify this performance. You will use this name to schedule the performance later on.", "");
	    if (!name || name === "") {
		alert("Please enter a name to identify your performance.");
		return;
	    }
	    var performance = {
		"name": name,
		"pieces": [],
		"performers": [],
		"event_id": '',
	    }
	    console.log('Adding performance:', JSON.stringify(performance));
	    addSpinner("performancelist"); // show the spinner.
	    addPerformanceFn(performance).then((result) => {
		console.log('Added performance: ', JSON.stringify(result));
		// Refresh the event panel to show new event.
		refreshPerformanceList();
	    });
	});
	$('#show-scheduled-performances-checkbox').on('click', function() {
	    refreshPerformanceList();
	});

	// Initialize UI.
	refreshPerformanceList();
	refreshLineup();
    }).catch(function(error) {
	// Handle Errors here.
	alert("Error: " + error.message);
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
    
    // Profile section.
    $('#profile-edit, #profile-save').on('click', function(){
  	var $form = $(this).closest('form');
  	$form.toggleClass('is-readonly is-editing');
	var isReadonly  = $form.hasClass('is-readonly');
	$form.find('input,textarea,select').prop('disabled', isReadonly);
	// Saving.
	if (isReadonly) {
	    // Validate.
	    if ($form.find('#displayname').val() === "" || $form.find('#email').val() === "") {
		alert("Please provide a name and e-mail.");
		return;
	    }
	    var profile = { "name":  $form.find('#displayname').val(),
			    "email" : $form.find('#email').val() };
	    // Save to firebase database.
	    setUserFn(profile).then((result) => {
		console.log('Updated user.');
	    }).catch(function(error) {
		console.log("error updating user: ", error);
	    });
	}
    });
    
});
