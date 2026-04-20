document.addEventListener('DOMContentLoaded', function () {
    // Supabase config
    var SUPABASE_URL = 'https://pqvynbhugyzlczxnizvj.supabase.co';
    var SUPABASE_KEY = 'sb_publishable_0GR_zDW6Rw0YJNPi0Ba1qQ_6PCVtvDG';
    var API_URL = SUPABASE_URL + '/rest/v1/rides';
    var HEADERS = {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
    };

    var NEARBY_CITIES = {
        'Plano': ['Frisco', 'Richardson', 'Allen', 'McKinney', 'Carrollton'],
        'Frisco': ['Plano', 'McKinney', 'Allen', 'Lewisville', 'The Colony'],
        'Richardson': ['Plano', 'Garland', 'Dallas', 'Carrollton', 'Allen'],
        'Irving': ['Dallas', 'Carrollton', 'Coppell', 'Arlington'],
        'Denton': ['Lewisville', 'Corinth', 'Lake Dallas', 'Flower Mound'],
        'McKinney': ['Allen', 'Frisco', 'Plano'],
        'Allen': ['Plano', 'McKinney', 'Frisco', 'Richardson'],
        'Carrollton': ['Plano', 'Richardson', 'Irving', 'Lewisville', 'Coppell'],
        'Lewisville': ['Denton', 'Flower Mound', 'Carrollton', 'The Colony', 'Frisco'],
        'Flower Mound': ['Lewisville', 'Denton', 'Carrollton'],
        'Coppell': ['Irving', 'Carrollton', 'Lewisville'],
        'Arlington': ['Irving', 'Dallas', 'Fort Worth'],
        'Garland': ['Richardson', 'Dallas', 'Plano'],
        'Dallas': ['Richardson', 'Irving', 'Garland', 'Arlington'],
        'Fort Worth': ['Arlington', 'Irving']
    };

    var state = { rides: [], matches: [], dismissed: [] };

    // Load dismissed from localStorage (personal preference)
    try {
        state.dismissed = JSON.parse(localStorage.getItem('desiride_dismissed')) || [];
    } catch (e) { state.dismissed = []; }

    function saveDismissed() {
        localStorage.setItem('desiride_dismissed', JSON.stringify(state.dismissed));
    }

    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    }

    // Supabase API calls
    function fetchRides() {
        fetch(API_URL + '?order=created.desc', {
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
        })
        .then(function (res) { return res.json(); })
        .then(function (rides) {
            state.rides = rides;
            state.matches = computeAllMatches();
            render();
        })
        .catch(function (err) {
            console.error('Failed to fetch rides:', err);
            showToast('Failed to load rides. Check connection.');
        });
    }

    function insertRide(ride) {
        return fetch(API_URL, {
            method: 'POST',
            headers: HEADERS,
            body: JSON.stringify(ride)
        });
    }

    function deleteRideFromDB(id) {
        return fetch(API_URL + '?id=eq.' + id, {
            method: 'DELETE',
            headers: HEADERS
        });
    }

    // Matching
    function areCitiesNearby(city1, city2) {
        if (city1.toLowerCase() === city2.toLowerCase()) return true;
        var neighbors = NEARBY_CITIES[city1] || [];
        for (var i = 0; i < neighbors.length; i++) {
            if (neighbors[i].toLowerCase() === city2.toLowerCase()) return true;
        }
        return false;
    }

    function isTimeClose(time1, time2) {
        if (!time1 || !time2) return true;
        var parts1 = time1.split(':');
        var parts2 = time2.split(':');
        var mins1 = parseInt(parts1[0]) * 60 + parseInt(parts1[1]);
        var mins2 = parseInt(parts2[0]) * 60 + parseInt(parts2[1]);
        return Math.abs(mins1 - mins2) <= 120;
    }

    function computeAllMatches() {
        var matches = [];
        var seen = {};
        for (var i = 0; i < state.rides.length; i++) {
            for (var j = i + 1; j < state.rides.length; j++) {
                var a = state.rides[i];
                var b = state.rides[j];
                if (a.direction !== b.direction) continue;
                if (a.type === b.type) continue;
                if (a.airport !== b.airport) continue;
                if (a.date !== b.date) continue;
                if (!areCitiesNearby(a.area, b.area)) continue;
                if (!isTimeClose(a.time, b.time)) continue;

                var matchId = [a.id, b.id].sort().join('-');
                if (seen[matchId]) continue;
                if (state.dismissed.indexOf(matchId) !== -1) continue;
                seen[matchId] = true;

                var offer = a.type === 'offer' ? a : b;
                var need = a.type === 'offer' ? b : a;
                var exact = a.area.toLowerCase() === b.area.toLowerCase();
                matches.push({
                    id: matchId,
                    offer: offer,
                    need: need,
                    score: exact ? 'exact' : 'nearby',
                    created: new Date().toISOString()
                });
            }
        }
        return matches;
    }

    function findMatchesForRide(newRide) {
        var count = 0;
        for (var i = 0; i < state.rides.length; i++) {
            var ride = state.rides[i];
            if (ride.id === newRide.id) continue;
            if (ride.direction !== newRide.direction) continue;
            if (ride.type === newRide.type) continue;
            if (ride.airport !== newRide.airport) continue;
            if (ride.date !== newRide.date) continue;
            if (!areCitiesNearby(ride.area, newRide.area)) continue;
            if (!isTimeClose(ride.time, newRide.time)) continue;
            count++;
        }
        return count;
    }

    // Formatting
    function formatDate(dateStr) {
        if (!dateStr) return '';
        var d = new Date(dateStr + 'T00:00:00');
        var today = new Date(); today.setHours(0,0,0,0);
        var tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
        if (d.getTime() === today.getTime()) return 'Today';
        if (d.getTime() === tomorrow.getTime()) return 'Tomorrow';
        return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }

    function formatTime(timeStr) {
        if (!timeStr) return '';
        var parts = timeStr.split(':');
        var h = parseInt(parts[0]); var m = parts[1];
        var ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return h + ':' + m + ' ' + ampm;
    }

    function getWhatsAppLink(phone, message) {
        var cleaned = phone.replace(/\D/g, '');
        if (cleaned.length === 10) cleaned = '1' + cleaned;
        return 'https://wa.me/' + cleaned + '?text=' + encodeURIComponent(message);
    }

    function getDirectionLabel(ride) {
        if (ride.direction === 'to') return ride.area + ' → ' + ride.airport;
        return ride.airport + ' → ' + ride.area;
    }

    function getTypeLabel(ride) {
        if (ride.direction === 'to' && ride.type === 'offer') return 'Driving to Airport';
        if (ride.direction === 'to' && ride.type === 'need') return 'Need Ride to Airport';
        if (ride.direction === 'from' && ride.type === 'offer') return 'Driving from Airport';
        return 'Need Ride from Airport';
    }

    // Render
    function renderRideCard(ride, showActions) {
        var typeClass = ride.type === 'offer' ? 'offer' : 'need';
        var dirIcon = ride.direction === 'to' ? '✈️' : '🏠';
        var seatsText = ride.seats ? ride.seats + ' seat' + (parseInt(ride.seats) > 1 ? 's' : '') : '';

        var html = '<div class="ride-card ' + typeClass + '" data-id="' + ride.id + '">';
        html += '<div class="ride-header">';
        html += '<span class="ride-type ' + typeClass + '">' + getTypeLabel(ride) + '</span>';
        html += '</div>';
        html += '<div class="ride-route">' + dirIcon + ' ' + getDirectionLabel(ride) + '</div>';
        html += '<div class="ride-details">';
        html += '<span>📅 ' + formatDate(ride.date) + '</span>';
        html += '<span>⏰ ' + formatTime(ride.time) + '</span>';
        html += '<span>💺 ' + seatsText + '</span>';
        html += '</div>';
        html += '<div class="ride-person">';
        html += '<span class="ride-person-info">👤 ' + ride.name + '</span>';
        html += '</div>';

        if (showActions) {
            var msg = 'Hi ' + ride.name + '! Saw your ride on DesiRide — '
                + getDirectionLabel(ride) + ', '
                + formatDate(ride.date) + ' ' + formatTime(ride.time) + '. Interested!';
            html += '<div class="ride-actions">';
            html += '<a href="' + getWhatsAppLink(ride.phone, msg) + '" target="_blank" class="btn-action whatsapp">📱 Connect on WhatsApp</a>';
            html += '<button class="btn-action delete" onclick="deleteRide(\'' + ride.id + '\')">🗑️</button>';
            html += '</div>';
        }

        html += '</div>';
        return html;
    }

    function renderMatchCard(match) {
        var badge = match.score === 'exact'
            ? '<span style="color: var(--green);">Same area!</span>'
            : '<span style="color: var(--orange);">Nearby areas</span>';

        var html = '<div class="match-card" data-match="' + match.id + '">';
        html += '<div class="match-header">🎉 Ride Found! ' + badge + '</div>';
        html += '<div class="match-pair">';
        html += renderRideCard(match.offer, true);
        html += '<div class="match-arrow">⇄</div>';
        html += renderRideCard(match.need, true);
        html += '</div>';
        html += '<div class="match-actions">';
        html += '<button class="btn-match dismiss" onclick="dismissMatch(\'' + match.id + '\')">Dismiss</button>';
        html += '</div>';
        html += '</div>';
        return html;
    }

    function render() {
        var toAirport = state.rides.filter(function (r) { return r.direction === 'to'; });
        var fromAirport = state.rides.filter(function (r) { return r.direction === 'from'; });

        document.getElementById('total-rides').textContent = state.rides.length;
        document.getElementById('total-rides-found').textContent = state.matches.length;

        // Rides Found
        var matchesHtml = '';
        for (var i = 0; i < state.matches.length; i++) {
            matchesHtml += renderMatchCard(state.matches[i]);
        }
        document.getElementById('rides-found-list').innerHTML = matchesHtml;
        document.getElementById('no-rides-found').style.display = state.matches.length ? 'none' : 'block';

        // To Airport
        var toHtml = '';
        for (var i = 0; i < toAirport.length; i++) {
            toHtml += renderRideCard(toAirport[i], true);
        }
        document.getElementById('to-airport-list').innerHTML = toHtml;
        document.getElementById('no-to-airport').style.display = toAirport.length ? 'none' : 'block';

        // From Airport
        var fromHtml = '';
        for (var i = 0; i < fromAirport.length; i++) {
            fromHtml += renderRideCard(fromAirport[i], true);
        }
        document.getElementById('from-airport-list').innerHTML = fromHtml;
        document.getElementById('no-from-airport').style.display = fromAirport.length ? 'none' : 'block';

        // All
        var allHtml = '';
        for (var i = 0; i < state.rides.length; i++) {
            allHtml += renderRideCard(state.rides[i], true);
        }
        document.getElementById('all-list').innerHTML = allHtml;
        document.getElementById('no-all').style.display = state.rides.length ? 'none' : 'block';
    }

    function showToast(message) {
        var toast = document.getElementById('toast');
        toast.textContent = message;
        toast.classList.remove('hidden');
        setTimeout(function () { toast.classList.add('hidden'); }, 3000);
    }

    // Form state
    var currentDirection = 'to';
    var currentType = 'offer';
    var selectedArea = '';
    var selectedAirport = 'DFW Airport';
    var selectedSeats = '1';

    function updateLabels() {
        var areaLabel = document.getElementById('area-label');
        var submitBtn = document.getElementById('submit-btn');

        if (currentDirection === 'to') {
            areaLabel.textContent = currentType === 'offer' ? 'Picking up from (your area)' : 'Pickup from (your area)';
            submitBtn.textContent = currentType === 'offer' ? 'Post — I\'m Driving to Airport' : 'Post — I Need a Ride to Airport';
        } else {
            areaLabel.textContent = currentType === 'offer' ? 'Dropping off to (your area)' : 'Drop off to (your area)';
            submitBtn.textContent = currentType === 'offer' ? 'Post — I\'m Driving from Airport' : 'Post — I Need a Ride from Airport';
        }
    }

    // Toggle buttons
    document.querySelectorAll('.toggle').forEach(function (btn) {
        btn.addEventListener('click', function () {
            document.querySelectorAll('.toggle').forEach(function (b) { b.classList.remove('active'); });
            this.classList.add('active');
            var val = this.getAttribute('data-type');
            if (val === 'to-offer') { currentDirection = 'to'; currentType = 'offer'; }
            if (val === 'to-need') { currentDirection = 'to'; currentType = 'need'; }
            if (val === 'from-offer') { currentDirection = 'from'; currentType = 'offer'; }
            if (val === 'from-need') { currentDirection = 'from'; currentType = 'need'; }
            updateLabels();
        });
    });

    // Area chips
    document.querySelectorAll('#area-picks .chip').forEach(function (chip) {
        chip.addEventListener('click', function () {
            document.querySelectorAll('#area-picks .chip').forEach(function (c) { c.classList.remove('selected'); });
            this.classList.add('selected');
            selectedArea = this.getAttribute('data-value');
            document.getElementById('area').value = selectedArea;
        });
    });

    // Airport chips
    document.querySelectorAll('.airport-chip').forEach(function (chip) {
        chip.addEventListener('click', function () {
            document.querySelectorAll('.airport-chip').forEach(function (c) { c.classList.remove('selected'); });
            this.classList.add('selected');
            selectedAirport = this.getAttribute('data-value');
        });
    });

    // Seat chips
    document.querySelectorAll('.seat-chip').forEach(function (chip) {
        chip.addEventListener('click', function () {
            document.querySelectorAll('.seat-chip').forEach(function (c) { c.classList.remove('selected'); });
            this.classList.add('selected');
            selectedSeats = this.getAttribute('data-value');
        });
    });

    // Default date
    var today = new Date();
    document.getElementById('date').value = today.getFullYear() + '-'
        + String(today.getMonth() + 1).padStart(2, '0') + '-'
        + String(today.getDate()).padStart(2, '0');

    updateLabels();

    // Form submit
    document.getElementById('ride-form').addEventListener('submit', function (e) {
        e.preventDefault();

        var submitBtn = document.getElementById('submit-btn');
        submitBtn.textContent = 'Posting...';
        submitBtn.disabled = true;

        var ride = {
            id: generateId(),
            type: currentType,
            direction: currentDirection,
            area: document.getElementById('area').value.trim(),
            airport: selectedAirport,
            date: document.getElementById('date').value,
            time: document.getElementById('time').value,
            name: document.getElementById('name').value.trim(),
            phone: document.getElementById('phone').value.trim(),
            seats: selectedSeats
        };

        insertRide(ride)
            .then(function (res) {
                if (res.ok) {
                    // Refresh rides from DB
                    return fetch(API_URL + '?order=created.desc', {
                        headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
                    });
                } else {
                    throw new Error('Failed to post');
                }
            })
            .then(function (res) { return res.json(); })
            .then(function (rides) {
                state.rides = rides;
                var matchCount = findMatchesForRide(ride);
                state.matches = computeAllMatches();
                render();

                if (matchCount > 0) {
                    showToast('🎉 ' + matchCount + ' ride' + (matchCount > 1 ? 's' : '') + ' found!');
                    document.querySelector('[data-tab="rides-found"]').click();
                } else {
                    showToast('✅ Ride posted!');
                    document.querySelector('[data-tab="all"]').click();
                }
            })
            .catch(function () {
                showToast('Failed to post ride. Try again.');
            })
            .finally(function () {
                submitBtn.disabled = false;
                updateLabels();
            });

        // Reset form
        document.getElementById('area').value = '';
        document.getElementById('time').value = '';
        document.getElementById('name').value = '';
        document.getElementById('phone').value = '';
        selectedArea = '';
        selectedSeats = '1';
        document.querySelectorAll('#area-picks .chip, .seat-chip').forEach(function (c) { c.classList.remove('selected'); });
    });

    // Tabs
    document.querySelectorAll('.tab').forEach(function (tab) {
        tab.addEventListener('click', function () {
            document.querySelectorAll('.tab').forEach(function (t) { t.classList.remove('active'); });
            document.querySelectorAll('.tab-content').forEach(function (c) { c.classList.remove('active'); });
            this.classList.add('active');
            document.getElementById(this.getAttribute('data-tab') + '-tab').classList.add('active');
        });
    });

    // Global functions
    window.deleteRide = function (id) {
        deleteRideFromDB(id).then(function () {
            state.rides = state.rides.filter(function (r) { return r.id !== id; });
            state.matches = computeAllMatches();
            render();
            showToast('Ride deleted');
        });
    };

    window.dismissMatch = function (matchId) {
        state.dismissed.push(matchId);
        saveDismissed();
        state.matches = computeAllMatches();
        render();
        showToast('Match dismissed');
    };

    // Auto-refresh every 30 seconds
    setInterval(fetchRides, 30000);

    // Initial load
    fetchRides();
});
