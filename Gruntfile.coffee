module.exports = (grunt) ->
  grunt.initConfig
    pkg: grunt.file.readJSON('package.json')
    compress:
      main:
        options:
          archive: '<%= pkg.name %>.zip'
        src: [
          'app.js'
          'bower_components/angular/angular.min.js'
          'bower_components/bootstrap/dist/css/bootstrap.min.css'
          'options.html'
          '*.png'
          'manifest.json'
          'main.css'
        ]
    exec:
      'chrome-preview': 'google-chrome --load-extension=./ --no-first-run || chrome.exe --load-extension=.\ --no-first-run'
    sass:
      options:
        sourceMap: true
      dist:
        files:
          'main.css': '*.scss'
    htmlhint:
      index:
        options:
          'tag-pair': true
          'id-unique': true
          'src-not-empty': true
        src: [
          'options.html'
        ]
    coffee:
      compile:
        files:
          'app.js': [
            'coffee/app.coffee'
            'coffee/filters/*.coffee'
            'coffee/services/*.coffee'
            'coffee/directives/*.coffee'
            'coffee/controllers/*.coffee'
          ]
    coffeelint:
      app: [
        'coffee/**/*.coffee'
      ]
    watch:
      html:
        files: 'options.html'
        tasks: 'htmlhint'
      sass:
        files: '*.scss'
        tasks: 'sass'
      coffee:
        files: 'coffee/**/*.coffee'
        tasks: [
          'coffeelint'
          'coffee'
        ]
  grunt.loadNpmTasks 'grunt-contrib-compress'
  grunt.loadNpmTasks 'grunt-sass'
  grunt.loadNpmTasks 'grunt-contrib-watch'
  grunt.loadNpmTasks 'grunt-htmlhint'
  grunt.loadNpmTasks 'grunt-contrib-coffee'
  grunt.loadNpmTasks 'grunt-coffeelint'
  grunt.loadNpmTasks 'grunt-exec'
  grunt.registerTask 'build', ['htmlhint','sass','coffeelint','coffee']
  grunt.registerTask 'dist', ['build', 'compress']
  grunt.registerTask 'preview', ['exec:chrome-preview']
  grunt.registerTask 'default', ['build','watch']
