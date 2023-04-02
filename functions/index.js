1// Neil-Bot cloud functions.

//!!! INSERT DATABASE PREFIX !!!//
const DATABASE_PREFIX = "insert-your-database-prefix-";

// Hard coded admin IDs. Keep in sync with firestore rules.
const ADMIN_UIDS = [
    // Replace with UIDs of admin users.
    "ADMIN1_UID",
    "ADMIN2_UID"
];

// Hard coded maximum yearly performance frequency.
const MAX_YEARLY_PERFORMANCES = 3;

// Hard coded blacklisted user IDs. They can't schedule performances.
const BLACKLISTED_IDS = [
    "BLACKLISTED1_UID",
    "BLACKLISTED2_UID",
];

const functions = require('firebase-functions');

// The Firebase Admin SDK to access Firestore.
const admin = require('firebase-admin');
admin.initializeApp();

// Dataset Handles
var db = admin.firestore();
var eventsRef = db.collection(DATABASE_PREFIX + "events");
var usersRef = db.collection(DATABASE_PREFIX + "users");
var performancesRef = db.collectionGroup("performances");

// Render date in MM/DD/YYYY format, from an epoc timestamp
function formatDate(time) {
    var d = new Date(time);
    let year = d.getFullYear();
    let month = (1 + d.getMonth()).toString().padStart(2, '0');
    let day = d.getDate().toString().padStart(2, '0');
    return month + '/' + day + '/' + year;
}

// Returns true iff the max difference in timestamps in this array is within a
// year.
function withinAYear(times) {
    return (Math.max(...times) - Math.min(...times)) < (365*24*60*60*1000);
}

function isAdmin(uid) {
    return ADMIN_UIDS.includes(uid);
}

function isBlacklisted(uid) {
    return BLACKLISTED_UIDS.includes(uid);
}

function makeEvent(data) {
    return {
	title: data.title,
	date: data.date,
	time: data.time,
	venue: data.venue,
	total_time: data.total_time,
	max_time: data.max_time,
	min_time: data.min_time,
	order: data.order,
	exempt: data.exempt,
    };
}

function makePerformance(data, uid) {
    return {
	name: data.name,
	pieces: data.pieces,
	performers: data.performers,
    };
}

// Admin functions
exports.addEvent = functions.https.onCall((data, context) => {
    if (!isAdmin(context.auth.uid)) {
	return { error: "Non-admins cannot edit events." };
    }
    var event = makeEvent(data);
    return eventsRef.add(event).then((docRef) => {
	console.log('Added event:', docRef.id);
	return { eid : docRef.id };
    }).catch((error) => {
	throw new functions.https.HttpsError(
	    'invalid-argument', ' add event failed with: ' + error); 
    });
});

exports.setEvent = functions.https.onCall((data, context) => {
    if (!isAdmin(context.auth.uid)) {
	return { error: "Non-admins cannot update events." };
    }
    return eventsRef.doc(data.eid).update(makeEvent(data)).then(() => {
	console.log('Updated event:', data.eid);
	return { eid : data.eid };
    }).catch((error) => {
	throw new functions.https.HttpsError(
	    'invalid-argument', ' update event failed with: ' + error); 
    });
});

// https://firebase.google.com/docs/functions/terminate-functions
const eventFetcher = async(cutoff) => {
    let results = await eventsRef
	.where("date", ">", cutoff)
	.orderBy("date", "asc")
	.get()
	.catch((error) => {
	    throw new functions.https.HttpsError(
		'internal', ' list event failed with: ' + error); 
	});
    var events = {};
    for (const e of results.docs) {
	events[e.id] = e.data();
    }
    return events;
}
exports.listEvent = functions.https.onCall((data, context) => {
    return eventFetcher(data.cutoff);
});

const eventDeleter = async(eid) => {
    let lineup = await eventsRef.doc(eid).collection('performances')
	.get().catch((error) => {
	    throw new functions.https.HttpsError(
		'internal', ' lookup lineup failed with: ' + error); 
	});
    if (lineup.size > 0) {
	return { error: "Event has scheduled performances." }
    }
    let r = await eventsRef.doc(eid).delete().then(() => {
	console.log('Deleted event:', eid);
    }).catch((error) => {
	throw new functions.https.HttpsError(
	    'invalid-argument', ' delete event failed with: ' + error); 
    });
    return { status: "Success" };
};
exports.deleteEvent = functions.https.onCall((data, context) => {
    if (!isAdmin(context.auth.uid)) {
	return { error: "Non-admins cannot delete events." };
    }
    return eventDeleter(data.eid)
});

// User functions
exports.setUser = functions.https.onCall((data, context) => {
    const uid = context.auth.uid;
    usersRef.doc(uid).set(data)
	.then(function() { console.log("Updated user."); })
	.catch(function(error) {
	    console.error("Error updating user: ", error);
	});
});

const userFetcher = async(uid) => {
    let results = await usersRef.doc(uid).get().catch((error) => {
	throw new functions.https.HttpsError(
	    'internal', ' get user failed with: ' + error); 
    });
    return results.data();
}
exports.getUser = functions.https.onCall((data, context) => {
    return userFetcher(context.auth.uid);
});

const userLister = async() => {
    let results = await usersRef
	.get()
	.catch((error) => {
	    throw new functions.https.HttpsError(
		'internal', ' list users failed with: ' + error); 
	});
    var users = {};
    for (const u of results.docs) {
	users[u.id] = u.data();
    }
    return users;
}
exports.listUser = functions.https.onCall((data, context) => {
    return userLister();
});

exports.addPerformance = functions.https.onCall((data, context) => {
    var performance = makePerformance(data);
    var uid = context.auth.uid;
    performance.uid = uid;
    performance.eid = '';
    return usersRef.doc(uid).collection('performances').add(performance).then((docRef) => {
	console.log('Added performance:', docRef.id);
	return { pid : docRef.id };
    }).catch((error) => {
	throw new functions.https.HttpsError(
	    'invalid-argument', ' add event failed with: ' + error); 
    });
});

exports.setPerformance = functions.https.onCall((data, context) => {
    var uid = context.auth.uid;
    return usersRef.doc(uid).collection('performances').doc(data.pid).update(makePerformance(data)).then(() => {
	console.log('Updated performance:', data.pid);
	return { pid : data.pid };
    }).catch((error) => {
	throw new functions.https.HttpsError(
	    'invalid-argument', ' update performance failed with: ' + error); 
    });
});

// Lists all scheduled performances from the provided events. Also list all
// unscheduled performances if no users is provided. If a user is provided,
// also list the unscheduled performances of that user (if allPerformance is
// false), or all performances of that user regardless of whether regardless of
// whether they are in the events list.
const performanceFetcher = async(uid, events, allPerformances) => {
    var promises = [];
    if (events.length > 0) {
	// Firebase 'in' selector clause takes a max of 10.
	var slice_size = 10;
	// So chunk up events array into chunks of 10.
	var events_sliced = Array(Math.ceil(events.length / slice_size)).fill().map((_,i) =>
	    events.slice(i * slice_size, i * slice_size + slice_size));
	// And issue that many where clauses.
	events_sliced.forEach(function(events_slice) {
	    promises.push(performancesRef.where("eid", "in", events_slice).get());
	});
    }
    if (!uid) {
	promises.push(performancesRef.where("eid", "==", "").get());
    } else {
	if (!allPerformances) {
	    promises.push(usersRef.doc(uid).collection('performances').get());
	} else {
	    promises.push(performancesRef.where("uid", "==", uid).get());
	}
    }
    let results = await Promise.all(promises)
	.catch((error) => {
	    throw new functions.https.HttpsError(
		'internal', ' list performance failed with: ' + error); 
	});
    var performances = {};
    results.forEach(function(result) {
	for (const p of result.docs) {
	    performances[p.id] = p.data();
	}
    });
    return performances;
}
exports.listPerformance = functions.https.onCall((data, context) => {
    var uid = context.auth.uid;
    var allPerformances = false;
    if (data.allUsers !== undefined && data.allUsers) {
	uid = null;
    } else if (data.allPerformances !== undefined && data.allPerformances) {
	allPerformances = true;
    }
    return performanceFetcher(uid, data.events, allPerformances);
});

exports.deletePerformance = functions.https.onCall((data, context) => {
    var uid = context.auth.uid;
    return usersRef.doc(uid).collection('performances').doc(data.pid).delete().then(() => {
	console.log('Deleted performance:', data.pid);
	return { pid : data.pid };
    }).catch((error) => {
	throw new functions.https.HttpsError(
	    'invalid-argument', ' delete performance failed with: ' + error); 
    });
});

// Scheduling functions.
async function schedulePerformanceInternal(uid, pid, eid, isAdmin, isBlacklisted) {
    let p =
	await usersRef.doc(uid).collection('performances').doc(pid)
	.get().catch((error) => {
	    throw new functions.https.HttpsError(
		'internal', ' lookup performance failed with: ' + error); 
	});
    var performance = p.data();
    let e = await eventsRef.doc(eid).get().catch((error) => {
	throw new functions.https.HttpsError(
	    'internal', ' lookup event failed with: ' + error); 
    });
    var event = e.data();

    // Enforce scheudling checks if not superuser.
    if (!isAdmin) {
	// 0) Check if the user is black listed.
	if (isBlacklisted) {
	    return { error: "This user cannot schedule performances." };
	}
	
	// 1) Check if the event is not already finalized.
	if (event.order.length != 0) {
	    return { error: "This event lineup is now final; you cannot schedule a performance in it." };
	}

	// 2) Make sure the performance duration time is allowed in the event.
	var performance_time = 0;
	performance.pieces.forEach(function(piece) {
	    performance_time += piece.duration;
	});
	if (performance_time > event.max_time ||
	    performance_time < event.min_time) {
	    return { error: "The performance time (" + performance_time + " mins) must be between " + event.min_time + " and " + event.max_time + " mins for the " + event.title + " event." };
	}
	
	// 3) Ensure there is enough time on the lineup.
	let lineup = await eventsRef.doc(eid).collection('performances')
	    .get().catch((error) => {
		throw new functions.https.HttpsError(
		    'internal', ' lookup lineup failed with: ' + error); 
	    });
	var remaining_time = event.total_time;
	for (const p of lineup.docs) {
	    p.data().pieces.forEach(function(piece) {
		remaining_time -= piece.duration;
	    });
	};
	if (remaining_time < performance_time) {
	    return { error: "Performance time (" + performance_time + " mins) exceeds the event's remaining time (" + remaining_time + " mins)." };
	}

	// 4) Ensure the user hasn't scheduled more than MAX_YEARLY_PERFORMANCES
	// non-exempt performances a year.
	if (!event.exempt) {
	    // Look up all the user's past and scheduled performances to collect
	    // the non-exempt events they are scheduled at.
	    let allPerformances = await performancesRef.where('uid', '==', uid)
		.where("eid", "!=" , "")
		.orderBy("eid", "asc")
		.get()
		.catch((error) => {
		    throw new functions.https.HttpsError(
			'internal',
			' list user performances failed with: ' + error); 
		});
	    var eventRefArr = [];
	    var lastEid = ""; // For de-duping.
	    for (const p of allPerformances.docs) {
		if (p.data().eid == lastEid) continue;
		lastEid = p.data().eid;
		eventRefArr.push(eventsRef.doc(p.data().eid));
	    }
	    // Look up all those events to filter out exempt events, and then
	    // collect the dates the non-exempt ones are at.
	    let performedEvents = eventRefArr.length == 0 ? [] :
		await db.getAll(...eventRefArr).catch((error) => {
		    throw new functions.https.HttpsError(
			'internal',
			' lookup user-performed event failed with: ' + error); 
		});
	    var performanceDates = performedEvents
		.filter((e) => { return !e.data().exempt; })
		.map((e) => { return e.data().date; });
	    // Sort the dates.
	    performanceDates.sort();
	    // For every sucessive MAX_YEARLY_PERFORMANCES dates, check whether
	    // adding the current event's date will exceed performances limits
	    // in a year.
	    for (var i = 0;
		 i+MAX_YEARLY_PERFORMANCES <= performanceDates.length;
		 ++i) {
		var a = performanceDates.slice(i, i+MAX_YEARLY_PERFORMANCES);
		a.push(event.date);
		if (withinAYear(a)) {
		    return { error: "You will have scheduled too many performances within a year on these dates: " + a.map((d) => { return formatDate(d); }).join() };
		}
	    }
	}
    }

    // Tag the performance with the event id.
    performance.eid = eid;

    // Add performance to event.
    let r1 = await eventsRef.doc(eid).collection('performances').doc(pid)
	.set(performance).then(() => {
	    console.log('Added performance to event ', pid + " to " + eid);
	    return true;
	}).catch((error) => {
	    throw new functions.https.HttpsError(
		'internal', ' add performance to event failed with: ' + error); 
	});

    // Remove performance from user.
    let r2 = await usersRef.doc(uid).collection('performances').doc(pid)
	.delete().then(() => {
	    console.log('Deleted performance from user ', pid + " from " + uid);
	    return true;
	});

    return { status: "Success" };
}

async function unschedulePerformanceInternal(uid, pid, eid, isAdmin) {
    let p =
	await eventsRef.doc(eid).collection('performances').doc(pid)
	.get().catch((error) => {
	    throw new functions.https.HttpsError(
		'internal', ' lookup performance failed with: ' + error); 
	});
    var performance = p.data();
    let e = await eventsRef.doc(eid).get().catch((error) => {
	throw new functions.https.HttpsError(
	    'internal', ' lookup event failed with: ' + error); 
    });
    var event = e.data();

    // Enforce unscheudling checks if not superuser.
    if (!isAdmin) {
	// Check if event is finalized.
	if (event.order.length != 0) {
	    return { error: "The event lineup is final; you cannot unschedule a performance in it." };
	}
    }

    // Clear the performance's event id.
    performance.eid = "";

    // Add performance to user.
    let r1 = usersRef.doc(uid).collection('performances').doc(pid)
	.set(performance).then(() => {
	    console.log('Added performance to user ', pid + " to " + uid);
	    return true;
	}).catch((error) => {
	    throw new functions.https.HttpsError(
		'internal', ' add performance to event failed with: ' + error); 
	});

    // Remove performance from event.
    let r2 = eventsRef.doc(eid).collection('performances').doc(pid)
	.delete().then(() => {
	    console.log('Deleted performance from event ', pid + " from " + eid);
	    return true;
	});

    return { status: "Success" };
}

exports.schedulePerformance = functions.https.onCall((data, context) => {
    if (context.auth.uid !== data.uid && !isAdmin(context.auth.uid)) {
	return { error: "Non-admins cannot schedule performance for someone else." };
    }
    return schedulePerformanceInternal(data.uid, data.pid, data.eid,
				       isAdmin(context.auth.uid),
				       isBlacklisted(context.auth.uid));
});
exports.unschedulePerformance = functions.https.onCall((data, context) => {
    if (context.auth.uid !== data.uid && !isAdmin(context.auth.uid)) {
	return { error: "Non-admins cannot unschedule performance for someone else." };
    }
    return unschedulePerformanceInternal(data.uid, data.pid, data.eid,
					 isAdmin(context.auth.uid));
});

