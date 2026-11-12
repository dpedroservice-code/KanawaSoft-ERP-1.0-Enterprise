(function () {
  'use strict';
  let map = null;
  let mapContainer = null;
  let watchId = null;
  let currentMarker = null;
  let originMarker = null;
  let destinationMarker = null;
  let routeLayer = null;
  let routeSelectionMode = null;
  const vehicleMarkers = new Map();
  let gpsRecordId = null;
  let lastSavedAt = 0;

  function loadLeaflet() {
    if (window.L) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      if (!document.getElementById('kanawaLeafletCss')) {
        const link = document.createElement('link');
        link.id = 'kanawaLeafletCss';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }
      const existing = document.getElementById('kanawaLeafletJs');
      if (existing) {
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
        if (window.L) resolve();
        return;
      }
      const script = document.createElement('script');
      script.id = 'kanawaLeafletJs';
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = resolve;
      script.onerror = function () { reject(new Error('A biblioteca do mapa não carregou. Verifique a internet.')); };
      document.head.appendChild(script);
    });
  }

  function mapStatus(message, isError) {
    const el = document.getElementById('frotaGpsMapStatus');
    if (el) {
      el.textContent = message;
      el.style.color = isError ? 'var(--danger)' : 'var(--text-muted)';
    }
  }

  function coordinates(item) {
    const lat = Number(item.lat !== undefined ? item.lat : item.latitude);
    const lng = Number(item.lng !== undefined ? item.lng : (item.longitude !== undefined ? item.longitude : item.lon));
    return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
  }

  function addVehicleMarker(item) {
    const point = coordinates(item);
    if (!map || !window.L || !point) return;
    const key = String(item.id || item.veiculo || (point[0] + ':' + point[1]));
    const latlng = point;
    const label = String(item.veiculo || 'Dispositivo');
    let marker = vehicleMarkers.get(key);
    if (marker) marker.setLatLng(latlng);
    else {
      marker = window.L.marker(latlng).addTo(map);
      vehicleMarkers.set(key, marker);
    }
    marker.bindPopup('<strong>' + label.replace(/[&<>"']/g, '') + '</strong><br>Atualizado: ' + String(item.ultimaAtualizacao || '—'));
  }

  async function refreshMarkers() {
    const rows = await getData('gpsTracking');
    (rows || []).forEach(addVehicleMarker);
  }

  window.renderFrotaGPSMapModule = async function () {
    const rows = await getData('gpsTracking') || [];
    const valid = rows.filter(function (item) {
      return item.coordinates_valid !== false && coordinates(item) !== null;
    });
    const tableRows = rows.map(function (item) {
      return ['<strong>' + esc(item.veiculo || 'Dispositivo') + '</strong>', esc(item.lat !== undefined ? item.lat : (item.latitude || '—')), esc(item.lng !== undefined ? item.lng : (item.longitude || item.lon || '—')),
        esc(item.location_source === 'device' ? 'GPS do dispositivo' : 'Manual'), fmtDT(item.ultimaAtualizacao),
        item.coordinates_valid === true ? '<span class="badge badge-success">Válida</span>' : '<span class="badge badge-warning">A verificar</span>'];
    });
    return header('GPS e Localização da Frota', valid.length + ' posições com coordenadas válidas', 'var(--info)',
      '<button class="btn btn-success" onclick="ativarGPSDispositivo()"><i class="fas fa-location-arrow"></i> Ativar GPS deste dispositivo</button> <button class="btn btn-secondary" onclick="pararGPSDispositivo()"><i class="fas fa-stop"></i> Parar</button>', 'fa-satellite') +
      '<div class="card"><div class="form-grid"><div class="form-group"><label>Veículo / dispositivo</label><input id="frotaGpsVehicle" placeholder="Ex.: Viatura 01"></div><div class="form-group"><label>Modo do mapa</label><div style="padding:10px">Satélite com opção de mapa de ruas</div></div></div>' +
      '<div id="frotaGpsMap" style="height:430px;min-height:320px;width:100%;border-radius:12px;background:var(--bg-hover);overflow:hidden"></div>' +
      '<p id="frotaGpsMapStatus" role="status" style="margin-top:10px;font-size:.85rem">A preparar o mapa. Para partilhar a posição, permita o acesso à localização do dispositivo.</p>' +
      '<p style="font-size:.78rem;color:var(--text-muted);margin-top:6px">As posições são guardadas localmente neste dispositivo. A sincronização de GPS entre empresas e filiais será activada numa etapa própria, com permissões e retenção de dados.</p>' +
      '<div class="ks-gps-route-card"><h3><i class="fas fa-route"></i> Planeamento de rota de entrega</h3>' +
      '<div class="ks-gps-route-grid">' +
      '<div class="form-group"><label>Ponto de saída — latitude</label><input id="originLat" inputmode="decimal" placeholder="-8.8389"></div>' +
      '<div class="form-group"><label>Ponto de saída — longitude</label><input id="originLng" inputmode="decimal" placeholder="13.2894"></div>' +
      '<div class="form-group"><label>Ponto de chegada — latitude</label><input id="destinationLat" inputmode="decimal" placeholder="-8.9000"></div>' +
      '<div class="form-group"><label>Ponto de chegada — longitude</label><input id="destinationLng" inputmode="decimal" placeholder="13.2000"></div></div>' +
      '<div class="ks-gps-route-actions"><button class="btn btn-outline-primary" onclick="usarLocalizacaoComoOrigem()"><i class="fas fa-crosshairs"></i> Usar localização actual</button>' +
      '<button class="btn btn-secondary" onclick="selecionarPontoRota(\'origin\')">Marcar saída no mapa</button>' +
      '<button class="btn btn-secondary" onclick="selecionarPontoRota(\'destination\')">Marcar chegada no mapa</button>' +
      '<button class="btn btn-primary" onclick="planFrotaRoute()" ' + (window.KANAWA_PREVIEW_READ_ONLY === true ? '' : 'disabled') + '><i class="fas fa-route"></i> Calcular rota</button></div>' +
      '<p id="frotaGpsRouteStatus" role="status" class="text-muted" style="font-size:.8rem;margin-top:8px">' +
      (window.KANAWA_PREVIEW_READ_ONLY === true ? 'Demonstração: cálculo de rota via OSRM público, apenas para pré-visualização.' : 'Roteamento de produção aguarda um fornecedor próprio e aprovado. Nenhuma API paga está configurada.') +
      '</p></div></div>' +
      '<div class="card"><h3 style="margin-bottom:12px">Posições registadas</h3>' + table(['Veículo / dispositivo','Latitude','Longitude','Origem','Última atualização','Validação'], tableRows) + '</div>';
  };

  function setRoutePoint(prefix, lat, lng) {
    const latInput = document.getElementById(prefix + 'Lat');
    const lngInput = document.getElementById(prefix + 'Lng');
    if (latInput) latInput.value = Number(lat).toFixed(6);
    if (lngInput) lngInput.value = Number(lng).toFixed(6);
    const point = [Number(lat), Number(lng)];
    const label = prefix === 'origin' ? 'Ponto de saída' : 'Ponto de chegada';
    let marker = prefix === 'origin' ? originMarker : destinationMarker;
    if (marker) marker.setLatLng(point);
    else marker = window.L.marker(point).addTo(map);
    marker.bindPopup(label);
    if (prefix === 'origin') originMarker = marker;
    else destinationMarker = marker;
  }

  function readRoutePoint(prefix) {
    const lat = Number(document.getElementById(prefix + 'Lat')?.value);
    const lng = Number(document.getElementById(prefix + 'Lng')?.value);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    return { lat, lng };
  }

  window.selecionarPontoRota = function (mode) {
    routeSelectionMode = mode === 'origin' ? 'origin' : 'destination';
    mapStatus('Toque no mapa para marcar o ponto de ' + (routeSelectionMode === 'origin' ? 'saída.' : 'chegada.'));
  };

  window.usarLocalizacaoComoOrigem = function () {
    if (!navigator.geolocation) { routeStatus('Este dispositivo não disponibiliza geolocalização.', true); return; }
    routeStatus('A obter a localização actual…');
    navigator.geolocation.getCurrentPosition(function (position) {
      setRoutePoint('origin', position.coords.latitude, position.coords.longitude);
      if (map) map.setView([position.coords.latitude, position.coords.longitude], 14);
      routeStatus('Localização actual definida como ponto de saída.');
    }, function (error) {
      routeStatus(error.message || 'Não foi possível obter a localização.', true);
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 });
  };

  function routeStatus(message, isError) {
    const el = document.getElementById('frotaGpsRouteStatus');
    if (el) { el.textContent = message; el.style.color = isError ? 'var(--danger)' : 'var(--text-muted)'; }
  }

  window.planFrotaRoute = async function () {
    if (window.KANAWA_PREVIEW_READ_ONLY !== true) {
      routeStatus('O serviço público de demonstração está bloqueado em produção. Configure um fornecedor de rotas próprio antes de activar entregas.', true);
      return;
    }
    const origin = readRoutePoint('origin');
    const destination = readRoutePoint('destination');
    if (!origin || !destination) { routeStatus('Marque a saída e a chegada no mapa ou introduza coordenadas válidas.', true); return; }
    if (!map || !window.L) { routeStatus('O mapa ainda não está pronto.', true); return; }
    routeStatus('A calcular a rota de condução…');
    try {
      const url = 'https://router.project-osrm.org/route/v1/driving/' +
        origin.lng + ',' + origin.lat + ';' + destination.lng + ',' + destination.lat +
        '?overview=full&geometries=geojson&steps=true';
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      const data = await response.json();
      if (!response.ok || data.code !== 'Ok' || !data.routes || !data.routes.length) throw new Error(data.message || 'Não foi encontrada uma rota rodoviária.');
      const route = data.routes[0];
      if (routeLayer) map.removeLayer(routeLayer);
      routeLayer = window.L.geoJSON(route.geometry, { style: { color: '#2563eb', weight: 5, opacity: 0.85 } }).addTo(map);
      map.fitBounds(routeLayer.getBounds(), { padding: [24, 24] });
      const km = (route.distance / 1000).toFixed(1);
      const minutes = Math.round(route.duration / 60);
      const duration = minutes >= 60 ? Math.floor(minutes / 60) + ' h ' + (minutes % 60) + ' min' : minutes + ' min';
      routeStatus('Rota de condução: ' + km + ' km · duração estimada: ' + duration + '. Estimativa do serviço de demonstração.');
    } catch (error) { routeStatus(error.message || 'Falha ao calcular a rota.', true); }
  };

  window.initFrotaGpsMap = async function () {
    const element = document.getElementById('frotaGpsMap');
    if (!element) return;
    await loadLeaflet();
    if (map && mapContainer !== element) { map.remove(); map = null; vehicleMarkers.clear(); currentMarker = null; }
    if (!map) {
      mapContainer = element;
      map = window.L.map(element, { scrollWheelZoom: true }).setView([-11.2, 17.8], 5);
      const satellite = window.L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        attribution: 'Tiles © Esri — Sources: Esri, Maxar, Earthstar Geographics'
      }).addTo(map);
      const streets = window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
      });
      let satelliteFailed = false;
      satellite.on('tileerror', function () {
        if (satelliteFailed) return;
        satelliteFailed = true;
        if (map && map.hasLayer(satellite)) map.removeLayer(satellite);
        streets.addTo(map);
        mapStatus('A camada de satélite não respondeu; foi activado o mapa de ruas.', true);
      });
      window.L.control.layers({ 'Satélite': satellite, 'Mapa de ruas': streets }).addTo(map);
      map.on('click', function (event) {
        if (!routeSelectionMode) return;
        setRoutePoint(routeSelectionMode, event.latlng.lat, event.latlng.lng);
        mapStatus('Ponto de ' + (routeSelectionMode === 'origin' ? 'saída' : 'chegada') + ' marcado no mapa.');
        routeSelectionMode = null;
      });
    } else {
      map.invalidateSize();
    }
    await refreshMarkers();
    mapStatus('Mapa carregado. Escolha Satélite ou Mapa de ruas no controlo do canto superior direito.');
  };

  window.ativarGPSDispositivo = function () {
    if (!navigator.geolocation) {
      mapStatus('Este dispositivo não disponibiliza geolocalização.', true);
      return;
    }
    if (watchId !== null) {
      mapStatus('O GPS deste dispositivo já está ativo.');
      return;
    }
    const vehicleInput = document.getElementById('frotaGpsVehicle');
    const vehicle = vehicleInput && vehicleInput.value.trim() ? vehicleInput.value.trim() : 'Dispositivo Android';
    const companyId = window.KanawaCloud && window.KanawaCloud.context && window.KanawaCloud.context.company
      ? window.KanawaCloud.context.company.id : 'local';
    const storageKey = 'kanawa_gps_record_' + companyId;
    gpsRecordId = localStorage.getItem(storageKey) || null;
    if (gpsRecordId && /^\d+$/.test(gpsRecordId)) gpsRecordId = Number(gpsRecordId);
    mapStatus('A solicitar permissão de localização ao Android…');
    watchId = navigator.geolocation.watchPosition(async function (position) {
      const coords = position.coords;
      const now = Date.now();
      const point = {
        id: gpsRecordId || undefined,
        veiculo: vehicle,
        lat: Number(coords.latitude),
        lng: Number(coords.longitude),
        accuracy_m: Number.isFinite(coords.accuracy) ? coords.accuracy : null,
        speed_mps: Number.isFinite(coords.speed) ? coords.speed : null,
        heading_deg: Number.isFinite(coords.heading) ? coords.heading : null,
        ultimaAtualizacao: new Date(position.timestamp || now).toISOString(),
        location_source: 'device',
        tracking_mode: 'device',
        coordinates_valid: true
      };
      addVehicleMarker(point);
      if (map) {
        if (currentMarker) currentMarker.setLatLng([point.lat, point.lng]);
        else currentMarker = window.L.circleMarker([point.lat, point.lng], { radius: 8, color: '#0ea5e9', fillOpacity: 0.9 }).addTo(map).bindPopup('Localização deste dispositivo');
        map.setView([point.lat, point.lng], Math.max(map.getZoom(), 15));
      }
      if (now - lastSavedAt > 10000) {
        lastSavedAt = now;
        try {
          const savedId = await saveData('gpsTracking', point);
          if (!gpsRecordId && savedId) {
            gpsRecordId = String(savedId);
            localStorage.setItem(storageKey, gpsRecordId);
          }
          mapStatus('GPS ativo. Precisão aproximada: ' + Math.round(coords.accuracy || 0) + ' m. Última atualização: ' + new Date().toLocaleTimeString());
        } catch (error) {
          mapStatus('A posição foi captada, mas não foi possível guardá-la: ' + error.message, true);
        }
      }
    }, function (error) {
      watchId = null;
      const messages = {
        1: 'Permissão de localização recusada. Ative a localização para este site nas definições do Android.',
        2: 'A posição não está disponível. Verifique o GPS e tente novamente.',
        3: 'A localização demorou demasiado tempo. Tente novamente.'
      };
      mapStatus(messages[error.code] || error.message || 'Erro ao obter localização.', true);
    }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
  };

  window.pararGPSDispositivo = function () {
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    watchId = null;
    mapStatus('GPS deste dispositivo parado. As posições já guardadas permanecem disponíveis.');
  };

  window.addEventListener('beforeunload', function () {
    if (watchId !== null && navigator.geolocation) navigator.geolocation.clearWatch(watchId);
  });
})();