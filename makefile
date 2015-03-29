all: main.user.js main.meta.js

main.user.js: meta.js main.js
	cat $^ > $@

main.meta.js: meta.js
	cat $^ > $@
