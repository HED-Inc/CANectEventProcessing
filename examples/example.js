let EventProcessor = require("../dist/index.js").default;

const ACCEL_SCALE = 1024;

const good_event = {
  // Unique arbitrary name
  name: "Z_SHOCK_EVENT",

  // Parameter labels to pass to 'calculate'
  params: ["Z_accel"],

  // Logic callback with params in same order as above after 'prev'
  async calculate(prev, [val]) {
    return Math.abs(val) / ACCEL_SCALE;
  },

  /**
   * Determine if the event should emit
   *
   * @param {prev} previous calculated value
   * @param {curr} current calculated valu
   * @param {timeDiff} time difference since last call in ms
   * @returns {boolean}
   */
  shouldEmit(prev, curr, timeDiff) {
    console.log("should emit:", prev, curr);
    return prev < 1 && curr > 1.25;
  },
};

const events = [
  {
    name: "ACCEL_EVENT",
    params: ["X_accel"],
    async calculate(prev, [val]) {
      return Math.abs(val) / ACCEL_SCALE;
    },
    shouldEmit(prev, curr) {
      return prev < 1 && curr > 1.25;
    },
  },
  {
    name: "TILT_EVENT",
    params: ["Y_tilt"],
    async calculate(prev, [val]) {
      console.log("calc", prev, val);
      return Math.abs(val);
    },
    shouldEmit(prev, curr) {
      return prev > 170 && curr > 0 && curr < 160;
    },
  },
];

let config = {
  ws_host: "10.1.1.1",
  vpca_group: "Event_Processing",
  chat_group: "Event_Processing",
  max_rate: 100,
  min_rate: 200,
};

let ep = new EventProcessor(config, events);
ep.setDebug(true);

let sub = ep.subscribe((e) => {
  console.log("EVENT", e);
});
