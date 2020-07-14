function displayQs(event) {
	document.getElementById("canceledDiv").style.display = 'block';
	document.getElementById("canceledDiv").style.borderStyle = 'dashed';
	//console.log(document.getElementById("canceledDiv").style.display);
}

function hideQs(event) {
	document.getElementById("canceledDiv").style.display = 'none';
}

function main() {
	document.getElementById("No").addEventListener("click", displayQs);
	document.getElementById("Yes").addEventListener("click", hideQs);
}

document.addEventListener("DOMContentLoaded", main);