let chalk = null;
import("chalk").then((module) => {
	chalk = module.default;
});

const timerColors = {
	blue: () => (chalk ? chalk.blue : (s) => s),
	yellow: () => (chalk ? chalk.yellow : (s) => s),
	red: () => (chalk ? chalk.red : (s) => s),
	green: () => (chalk ? chalk.green : (s) => s),
	magenta: () => (chalk ? chalk.magenta : (s) => s),
};

let timers = {};

function startTimer(timerName, color = "blue") {
	if (timers[timerName]) {
		console.warn(
			"Timer with this name already exists. Please use a different name."
		);
	} else {
		timers[timerName] = { colorFunc: timerColors[color]() };
		console.time(timers[timerName].colorFunc(timerName));
	}
}

function endTimer(timerName) {
	if (!timers[timerName]) {
		console.warn(
			"Timer with this name does not exist. Please check the timer name."
		);
	} else {
		console.timeEnd(timers[timerName].colorFunc(timerName));
		delete timers[timerName];
	}
}

module.exports = { startTimer, endTimer };
