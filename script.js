'use strict';

class Workout {
  date = new Date();
  id = (Date.now() + '').slice(-10);
  clicks = 0;

  constructor(coords, distance, duration) {
    this.coords = coords; // [lat, lng]
    this.distance = distance; // km
    this.duration = duration; // min
  }

  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }

  click() {
    this.clicks++;
  }
}

class Running extends Workout {
  type = 'running';

  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence; // steps/min
    this.calcPace();
    this._setDescription();
  }

  calcPace() {
    // min/km
    this.pace = this.duration / this.distance;
    return this.pace; // m
  }
}

class Cycling extends Workout {
  type = 'cycling';

  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

const run1 = new Running([39, -12], 5.2, 178);
const cycling1 = new Cycling([39, -12], 27, 523);
// console.log(run1, cycling1);

// ================================================================================================
// ! || APPLICATION ARCHITECTURE
const form = document.querySelector('.form');
const btnDeleteWorkouts = document.querySelector('.delete__workouts');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');

class App {
  #map;
  #mapZoom = 14;
  #mapEvent;
  #workouts = [];
  #markers = [];

  constructor() {
    // Get user's position
    this._getPosition();

    // Get data from LocalStorage
    this._getLocalStorage();

    // Attache Event Handlers
    form.addEventListener('submit', this._newWorkout.bind(this));
    inputType.addEventListener(
      'change',
      this._toggleEleevationField.bind(this)
    );
    containerWorkouts.addEventListener(
      'click',
      this._clickWorkoutAction.bind(this)
    );
    containerWorkouts.addEventListener(
      'mouseover',
      this._appearActions.bind(this)
    );
    containerWorkouts.addEventListener(
      'mouseout',
      this._disappearActions.bind(this)
    );
    btnDeleteWorkouts.addEventListener(
      'click',
      this._deleteAllWorkouts.bind(this)
    );
  }

  _getPosition() {
    navigator.geolocation &&
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          alert("Can't get your position");
        }
      );
  }

  _loadMap(position) {
    const { latitude } = position.coords;
    const { longitude } = position.coords;
    const coords = [latitude, longitude];
    // console.log(`https://www.google.com/maps/@${latitude},${longitude}`);

    this.#map = L.map('map').setView(coords, this.#mapZoom);

    L.tileLayer('https://tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    // Handling clicks on map
    this.#map.on('click', this._showForm.bind(this));

    this.#workouts.forEach(w => {
      // console.log(w);
      this._renderWorkoutMarker(w);
    });
  }

  _showForm(mapE) {
    this.#mapEvent = mapE;
    form.classList.remove('hidden');
    inputDistance.focus();
  }

  _hideForm() {
    // prettier-ignore
    inputDistance.value = inputDuration.value = inputCadence.value = inputElevation.value = '';

    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  _toggleEleevationField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  _newWorkout(e) {
    const validInputs = (...inputs) =>
      inputs.every(inp => Number.isFinite(inp));

    const allPositive = (...inputs) => inputs.every(inp => inp > 0);

    e.preventDefault();

    // Get data from the form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const { lat, lng } = this.#mapEvent.latlng;
    let workout;

    // If workout is running, create running object
    if (type === 'running') {
      const cadence = +inputCadence.value;
      // Check if data is valid
      if (
        !validInputs(distance, duration, cadence) ||
        !allPositive(distance, duration, cadence)
      )
        return alert('Inputs have to be positive numbers!');

      workout = new Running([lat, lng], distance, duration, cadence);
    }

    // If workout is cycling, create cycling object
    if (type === 'cycling') {
      const elevation = +inputElevation.value;
      // Check if data is valid
      if (
        !validInputs(distance, duration, elevation) ||
        !allPositive(distance, duration)
      )
        return alert('Inputs have to be positive numbers!');

      workout = new Cycling([lat, lng], distance, duration, elevation);
    }

    // Add new object to workout array
    this.#workouts.push(workout);
    // console.log(this.#workouts);

    // Render workout on map as marker
    this._renderWorkoutMarker(workout);

    // Render workout on list
    this._renderWorkout(workout);

    // Hide form + clear input fields
    this._hideForm();

    // Set LocalStorage to all workouts
    this._setLocalStorage();

    // Show delete all button
    this._showDelete();
  }

  _renderWorkoutMarker(workout) {
    const marker = L.marker(workout.coords);
    this.#markers.push(marker);

    marker
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.description}`
      )
      .openPopup();
  }

  _renderWorkout(workout) {
    let html = `
      <li class="workout workout--${workout.type}" data-id="${workout.id}">
        <h2 class="workout__title">${workout.description}</h2>
        <div class="workout__btn hidden workout__btn--edit">
          <span>EDIT</span>
        </div>
        <div class="workout__btn hidden workout__btn--delete">
          <span>DELETE</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">${
            workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'
          }</span>
          <span class="workout__value">${workout.distance}</span>
          <span class="workout__unit">km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⏱️</span>
          <span class="workout__value">${workout.duration}</span>
          <span class="workout__unit">min</span>
        </div>`;

    if (workout.type === 'running')
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.pace.toFixed(1)}</span>
          <span class="workout__unit">min/km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">🦶🏼</span>
          <span class="workout__value">${workout.cadence}</span>
          <span class="workout__unit">spm</span>
        </div>
      </li>`;

    if (workout.type === 'cycling')
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.speed.toFixed(1)}</span>
          <span class="workout__unit">km/h</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⛰️</span>
          <span class="workout__value">${workout.elevationGain}</span>
          <span class="workout__unit">m</span>
        </div>
      </li>`;

    form.insertAdjacentHTML('afterend', html);
  }

  _clickWorkoutAction(e) {
    const workoutEl = e.target.closest('.workout');
    // console.log(workoutEl);
    if (!workoutEl) return;

    // console.log(e.target);
    // console.log(e.currentTarget);
    // console.log(workoutEl.querySelector('.workout__btn--delete'));

    // Delete
    if (e.target.closest('.workout__btn--delete')) {
      const btnDelete = e.target.closest('.workout__btn--delete');

      this._deleteWorkout(btnDelete);

      if (!this.#workouts[0]) this._hideDelete();
      return;
    }

    // Edit
    // TODO:
    if (e.target.closest('.workout__btn--edit')) {
      const btnEdit = e.target.closest('.workout__btn--edit');

      this._editWorkout(btnEdit);

      return;
    }

    const workout = this.#workouts.find(w => w.id === workoutEl.dataset.id);
    // console.log(workout);

    this.#map.setView(workout.coords, this.#mapZoom, {
      animate: true,
      pan: {
        duration: 1,
      },
    });

    // Using the public interface
    workout.click(); // викликає проблеми з LocalStorage
  }

  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));
    console.log(data);

    if (!data) return;

    data.map(w => {
      if (w.type === 'running') w.__proto__ = new Running();
      if (w.type === 'cycling') w.__proto__ = new Cycling();
      return w;
    });

    this.#workouts = data;

    this.#workouts.forEach(w => {
      this._renderWorkout(w);
      // this._renderWorkoutMarker(w);
    });

    this._showDelete();
  }

  _reset() {
    localStorage.removeItem('workouts');
    location.reload();
    this._hideDelete();
  }

  _appearActions(e) {
    const workoutEl = e.target.closest('.workout');
    // console.log(workoutEl);

    if (!workoutEl) return;
    workoutEl
      .querySelectorAll('.workout__btn')
      .forEach(btn => btn.classList.remove('hidden'));
  }

  _disappearActions(e) {
    const workoutEl = e.target.closest('.workout');
    // console.log(workoutEl);

    if (!workoutEl) return;

    workoutEl
      .querySelectorAll('.workout__btn')
      .forEach(btn => btn.classList.add('hidden'));
  }

  _showDelete() {
    btnDeleteWorkouts.classList.remove('hidden');
  }

  _hideDelete() {
    btnDeleteWorkouts.classList.add('hidden');
  }

  _deleteAllWorkouts() {
    this._reset();
  }

  _deleteWorkout(btnDel) {
    const workoutEl = btnDel.closest('.workout');
    const workoutIndex = this.#workouts.findIndex(
      item => item.id === workoutEl.dataset.id
    );

    // Delete workout from array
    this.#workouts.splice(workoutIndex, 1);

    // Delete marker
    const marker = this.#markers[workoutIndex];
    this.#markers.splice(workoutIndex, 1);
    this.#map.removeLayer(marker);

    // Delete from local storage
    localStorage.removeItem('workouts');
    this._setLocalStorage();

    // Delete from sidebar
    workoutEl.remove();
  }

  // TODO:
  _editWorkout(btnEdit) {
    const workoutEl = btnEdit.closest('.workout');
    const workoutIndex = this.#workouts.findIndex(
      item => item.id === workoutEl.dataset.id
    );

    // Remove element from sidebar

    // Show form for changes

    // Hide form after ended
  }
}

const app = new App();
