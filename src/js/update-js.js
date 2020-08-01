function displayQs(event) {
	document.getElementById("canceledDiv").style.display = 'block';
	document.getElementById("canceledDiv").style.borderStyle = 'dashed';
	document.getElementById("nextDiv").style.display = 'none';
	document.getElementById("lastDiv").style.display = 'none';
}

function hideQs(event) {
	document.getElementById("canceledDiv").style.display = 'none';
	document.getElementById("lastDiv").style.display = 'block';
}

function displayNextQ(event) {
	document.getElementById("nextDiv").style.display = 'block';
}

function hideNextQ(event) {
	document.getElementById("nextDiv").style.display = 'none';
}

function main() {
	document.getElementById("No").addEventListener("click", displayQs);
	document.getElementById("Yes").addEventListener("click", hideQs);
	document.getElementById("yesLast").addEventListener("click", hideNextQ);
	document.getElementById("noLast").addEventListener("click", displayNextQ);
	document.getElementById("nextDiv").style.display = 'none';
}

document.addEventListener("DOMContentLoaded", main);