document.addEventListener('DOMContentLoaded', function () {
    var STORAGE_KEY = 'desiride_data';
    var NEARBY_CITIES = {
        'Plano': ['Frisco', 'Richardson', 'Allen', 'McKinney', 'Carrollton'],
        'Frisco': ['Plano', 'McKinney', 'Allen', 'Lewisville', 'The Colony'],
        'Richardson': ['Plano', 'Garland', 'Dallas', 'Carrollton', 'Allen'],
        'Irving': ['Dallas', 'Carrollton', 'Coppell', 'Arlington', 'Las Colinas'],
        'Denton': ['Lewisville', 'Corinth', 'Lake Dallas', 'Flower Mound'],
        'McKinney': ['Allen', 'Frisco', 'Plano', 'Princeton'],
        'Allen': ['Plano', 'McKinney', 'Frisco', 'Richardson'],
        'Carrollton': ['Plano', 'Richardson', 'Irving', 'Lewisville', 'Coppell'],
        'Lewisville': ['Denton', 'Flower Mound', 'Carrollton', 'The Colony', 'Frisco'],
        'DFW Airport': ['Irving', 'Grapevine', 'Coppell', 'Euless'],
        'Love Field': ['Dallas', 'Irving', 'Richardson'],
        'Flower Mound': ['Lewisville', 'Denton', 'Carrollton'],
        'Coppell': ['Irving', 'Carrollton', 'Lewisville'],
        'Arlington': ['Irving', 'Dallas', 'Fort Worth'],
        'Garland': ['Richardson', 'Dallas', 'Plano'],
        'Dallas': ['Richardson', 'Irving', 'Garland', 'Arlington']
    };

    var state = loadState();

    function loadState() {
        try {
            var data = JSON.parse(localStorage.getItem(STORAGE_KEY));
            return data || { rides: [], matches: [], dismissed: [] };
        } catch (e) {
            return { rides: [], matches: [], dismissed: [] };
        }
    }

    function saveState() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }

    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    }

    function areCitiesNearby(city1, city2) {
        if (city1.toLowerCase() === city2.toLowerCase()) return true;
        var neighbors = NEARBY_CITIES[city1] || [];
        for (var i = 0; i < neighbors.length; i++) {
            if (neighbors[i].toLowerCase() === city2.toLowerCase()) return true;
        }
        return false;
    }

    function isTimeClose(time1, time2, hours) {
        if (!time1 || !time2) return true;
        var parts1 = time1.split(':');
        var parts2 = time2.split(':');
        var mins1 = parseInt(parts1[0]) * 60 + parseInt(parts1[1]);
        var mins2 = parseInt(parts2[0]) * 60 + parseInt(parts2[1]);
        return Math.abs(mins1 - mins2) <= (hours || 2) * 60;
    }

    function findMatches(newRide) {
        var matches = [];
        var oppositeType = newRide.type === 'offer' ? 'need' : 'offer';

        for (var i = 0; i < state.rides.length; i++) {
            var ride = state.rides[i];
            if (ride.id === newRide.id) continue;
            if (ride.type !== oppositeType) continue;

            var fromMatch = areCitiesNearby(newRide.from, ride.from);
            var toMatch = areCitiesNearby(newRide.to, ride.to);
            var dateMatch = newRide.date === ride.date;
            var timeMatch = isTimeClose(newRide.time, ride.time, 2);

            if (fromMatch && toMatch && dateMatch && timeMatch) {
                var matchId = [newRide.id, ride.id].sort().join('-');
                var isDismissed = state.dismissed.indexOf(matchId) !== -1;
                var alreadyExists = false;
                for (var j = 0; j < state.matches.length; j++) {
                    if (state.matches[j].id === matchId) {
                        alreadyExists = true;
                        break;
                    }
                }
                if (!isDismissed && !alreadyExists) {
                    var exact = newRide.from.toLowerCase() === ride.from.toLowerCase()
                        && newRide.to.toLowerCase() === ride.to.toLowerCase();
                    matches.push({
                        id: matchId,
                        offer: newRide.type === 'offer' ? newRide : ride,
                        need: newRide.type === 'need' ? newRide : ride,
                        score: exact ? 'exact' : 'nearby',
                        created: new Date().toISOString()
                    });
                }
            }
        }
        return matches;
    }

    function formatDate(dateStr) {
        if (!dateStr) return '';
        var d = new Date(dateStr + 'T00:00:00');
        var today = new Date();
        today.setHours(0,0,0,0);
        var tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        if (d.getTime() === today.getTime()) return 'Today';
        if (d.getTime() === tomorrow.getTime()) return 'Tomorrow';
        return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }

    function formatTime(timeStr) {
        if (!timeStr) return '';
        var parts = timeStr.split(':');
        var h = parseInt(parts[0]);
        var m = parts[1];
        var ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return h + ':' + m + ' ' + ampm;
    }

    function getWhatsAppLink(phone, message) {
        var cleaned = phone.replace(/\D/g, '');
        if (cleaned.length === 10) cleaned = '1' + cleaned;
        return 'https://wa.me/' + cleaned + '?text=' + encodeURIComponent(message);
    }

    function renderRideCard(ride, showActions) {
        var typeClass = ride.type === 'offer' ? 'offer' : 'need';
        var typeLabel = ride.type === 'offer' ? 'Offering Ride' : 'Need Ride';
        var seatsText = ride.seats ? ' · ' + ride.seats + ' seat' + (ride.seats > 1 ? 's' : '') : '';

        var html = '<div class="ride-card ' + typeClass + '" data-id="' + ride.id + '">';
        html += '<div class="ride-header">';
        html += '<span class="ride-type ' + typeClass + '">' + typeLabel + '</span>';
        html += '<span class="ride-source">' + (ride.source || 'Direct') + '</span>';
        html += '</div>';
        html += '<div class="ride-route">' + ride.from + '<span class="arrow"> → </span>' + ride.to + '</div>';
        html += '<div class="ride-details">';
        html += '<span>📅 ' + formatDate(ride.date) + '</span>';
        html += '<span>⏰ ' + formatTime(ride.time) + '</span>';
        html += '<span>💺' + seatsText + '</span>';
        html += '</div>';
        html += '<div class="ride-person">';
        html += '<span class="ride-person-info">👤 ' + ride.name + '</span>';
        html += '</div>';

        if (showActions) {
            var msg = 'Hi ' + ride.name + '! Saw your ride on DesiRide — '
                + ride.from + ' → ' + ride.to + ', '
                + formatDate(ride.date) + ' ' + formatTime(ride.time) + '. Interested!';
            html += '<div class="ride-actions">';
            html += '<a href="' + getWhatsAppLink(ride.phone, msg) + '" target="_blank" class="btn-action whatsapp">📱 Connect on WhatsApp</a>';
            html += '<button class="btn-action delete" onclick="deleteRide(\'' + ride.id + '\')">🗑️ Delete</button>';
            html += '</div>';
        }

        html += '</div>';
        return html;
    }

    function renderMatchCard(match) {
        var driverMsg = 'Hi ' + match.offer.name + '! Found a rider for your '
            + match.offer.from + ' → ' + match.offer.to + ' ride on '
            + formatDate(match.offer.date) + '. '
            + match.need.name + ' needs a ride. Contact them at ' + match.need.phone;

        var riderMsg = 'Hi ' + match.need.name + '! Found a ride for you! '
            + match.offer.name + ' is going '
            + match.offer.from + ' → ' + match.offer.to + ' on '
            + formatDate(match.offer.date) + ' at ' + formatTime(match.offer.time)
            + '. Contact: ' + match.offer.phone;

        var badge = match.score === 'exact'
            ? '<span style="color: var(--green);">Exact route match!</span>'
            : '<span style="color: var(--orange);">Nearby cities match</span>';

        var crossGroup = match.offer.source !== match.need.source
            ? ' <span style="color: var(--primary); font-size: 0.8rem;">Cross-group: ' + match.offer.source + ' + ' + match.need.source + '</span>'
            : '';

        var html = '<div class="match-card" data-match="' + match.id + '">';
        html += '<div class="match-header">🎉 Ride Found! ' + badge + crossGroup + '</div>';
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
        var offers = state.rides.filter(function (r) { return r.type === 'offer'; });
        var needs = state.rides.filter(function (r) { return r.type === 'need'; });

        document.getElementById('total-rides').textContent = state.rides.length;
        document.getElementById('total-rides-found').textContent = state.matches.length;

        // Rides Found
        var matchesHtml = '';
        for (var i = state.matches.length - 1; i >= 0; i--) {
            matchesHtml += renderMatchCard(state.matches[i]);
        }
        document.getElementById('rides-found-list').innerHTML = matchesHtml;
        document.getElementById('no-rides-found').style.display = state.matches.length ? 'none' : 'block';

        // Offers
        var offersHtml = '';
        for (var i = offers.length - 1; i >= 0; i--) {
            offersHtml += renderRideCard(offers[i], true);
        }
        document.getElementById('offers-list').innerHTML = offersHtml;
        document.getElementById('no-offers').style.display = offers.length ? 'none' : 'block';

        // Needs
        var needsHtml = '';
        for (var i = needs.length - 1; i >= 0; i--) {
            needsHtml += renderRideCard(needs[i], true);
        }
        document.getElementById('needs-list').innerHTML = needsHtml;
        document.getElementById('no-needs').style.display = needs.length ? 'none' : 'block';

        // All
        var allHtml = '';
        for (var i = state.rides.length - 1; i >= 0; i--) {
            allHtml += renderRideCard(state.rides[i], true);
        }
        document.getElementById('all-list').innerHTML = allHtml;
        document.getElementById('no-all').style.display = state.rides.length ? 'none' : 'block';
    }

    function showToast(message) {
        var toast = document.getElementById('toast');
        toast.textContent = message;
        toast.classList.remove('hidden');
        setTimeout(function () {
            toast.classList.add('hidden');
        }, 3000);
    }

    // Form handling
    var currentType = 'offer';
    var selectedFrom = '';
    var selectedTo = '';
    var selectedSource = '';
    var selectedSeats = '';

    // Toggle offer/need
    document.querySelectorAll('.toggle').forEach(function (btn) {
        btn.addEventListener('click', function () {
            document.querySelectorAll('.toggle').forEach(function (b) { b.classList.remove('active'); });
            this.classList.add('active');
            currentType = this.getAttribute('data-type');
        });
    });

    // Chip selection helper
    function setupChips(containerSelector, inputId, setter) {
        document.querySelectorAll(containerSelector).forEach(function (chip) {
            chip.addEventListener('click', function () {
                var siblings = this.parentElement.querySelectorAll('.chip');
                siblings.forEach(function (s) { s.classList.remove('selected'); });
                this.classList.add('selected');
                var value = this.getAttribute('data-value');
                document.getElementById(inputId).value = value;
                setter(value);
            });
        });
    }

    setupChips('#from-picks .chip', 'from', function (v) { selectedFrom = v; });
    setupChips('#to-picks .chip', 'to', function (v) { selectedTo = v; });
    setupChips('.seat-chip', 'from', function (v) { selectedSeats = v; });
    setupChips('.price-chip', 'from', function (v) { selectedPrice = v; });

    // Seat chips
    document.querySelectorAll('.seat-chip').forEach(function (chip) {
        chip.addEventListener('click', function () {
            document.querySelectorAll('.seat-chip').forEach(function (s) { s.classList.remove('selected'); });
            this.classList.add('selected');
            selectedSeats = this.getAttribute('data-value');
        });
    });

    // Set default date to today
    var today = new Date();
    var todayStr = today.getFullYear() + '-'
        + String(today.getMonth() + 1).padStart(2, '0') + '-'
        + String(today.getDate()).padStart(2, '0');
    document.getElementById('date').value = todayStr;

    // Form submit
    document.getElementById('ride-form').addEventListener('submit', function (e) {
        e.preventDefault();

        var ride = {
            id: generateId(),
            type: currentType,
            from: document.getElementById('from').value.trim(),
            to: document.getElementById('to').value.trim(),
            date: document.getElementById('date').value,
            time: document.getElementById('time').value,
            name: document.getElementById('name').value.trim(),
            phone: document.getElementById('phone').value.trim(),
            source: document.getElementById('source').value.trim() || 'Direct',
            seats: selectedSeats || '1',
            created: new Date().toISOString()
        };

        state.rides.push(ride);

        var newMatches = findMatches(ride);
        for (var i = 0; i < newMatches.length; i++) {
            state.matches.push(newMatches[i]);
        }

        saveState();
        render();

        if (newMatches.length > 0) {
            showToast('🎉 ' + newMatches.length + ' ride' + (newMatches.length > 1 ? 's' : '') + ' found!');
            document.querySelector('[data-tab="rides-found"]').click();
        } else {
            showToast('✅ Ride added! No matches yet.');
        }

        // Reset form partially
        document.getElementById('from').value = '';
        document.getElementById('to').value = '';
        document.getElementById('time').value = '';
        document.getElementById('name').value = '';
        document.getElementById('phone').value = '';
        selectedFrom = '';
        selectedTo = '';
        selectedSeats = '';
        document.querySelectorAll('#from-picks .chip, #to-picks .chip, .seat-chip').forEach(function (c) {
            c.classList.remove('selected');
        });
    });

    // Tabs
    document.querySelectorAll('.tab').forEach(function (tab) {
        tab.addEventListener('click', function () {
            document.querySelectorAll('.tab').forEach(function (t) { t.classList.remove('active'); });
            document.querySelectorAll('.tab-content').forEach(function (c) { c.classList.remove('active'); });
            this.classList.add('active');
            var target = this.getAttribute('data-tab');
            document.getElementById(target + '-tab').classList.add('active');
        });
    });

    // Filter All Rides tab
    window.filterAll = function (type) {
        var filtered = state.rides;
        if (type !== 'all') {
            filtered = state.rides.filter(function (r) { return r.type === type; });
        }
        var html = '';
        for (var i = filtered.length - 1; i >= 0; i--) {
            html += renderRideCard(filtered[i], true);
        }
        document.getElementById('all-list').innerHTML = html;
        document.getElementById('no-all').style.display = filtered.length ? 'none' : 'block';
    };

    // Global functions for buttons
    window.deleteRide = function (id) {
        state.rides = state.rides.filter(function (r) { return r.id !== id; });
        state.matches = state.matches.filter(function (m) {
            return m.offer.id !== id && m.need.id !== id;
        });
        saveState();
        render();
        showToast('Ride deleted');
    };

    window.dismissMatch = function (matchId) {
        state.dismissed.push(matchId);
        state.matches = state.matches.filter(function (m) { return m.id !== matchId; });
        saveState();
        render();
        showToast('Match dismissed');
    };

    render();
});
