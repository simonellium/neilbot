# neilbot

Recital Scheduler (code name: Neilbot) was developed in Mar 2021 by Simon Yau, Association of Classical Musicians and Artists (ACMA) Digital Director, for members to schedule performances in ACMA Concerts. ACMA members can log into Neilbot using their existing Google or Facebook accounts, create performances and schedule them on ACMA events. ACMA administrators can log into Neilbot to create ACMA events, adjust event lineups, and find contact information of event performers. 

Neilbot was tested as a webbapp, hosted on Firebase web hosting with Firebase functions and Firestore backend. It requires the webapp to be able to use firestore authentication via Google or Facebook authentication services. It also requires a Firebase function and Firebase Cloud Firestore backend. 

Configure Firestore by naming a firestore collection, and specifying it as `DATABASE_PREFIX` in `functions/index.js` and replacing the `DATABASE_PREFIX` in `firestore.rules`. Find the firesore authentication UIDs of Neilbot admins and specify their `ADMIN*_UIDs` in `functions/index.js` and `firestore.rules`.

Deploy the firetore using the `firestore.rules` and `firestore.indexes.json`, and deploy firestore functions using `functions/index.js`. 

