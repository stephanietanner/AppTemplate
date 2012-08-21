require 'fileutils'
require 'net/http'
require 'uri'
require 'json'

#require 'net/https'


ENABLE_JSLINT = ENV['ENABLE_JSLINT'] == 'true'

task :default => [:debug, :build]

desc "Create an app with the provided name (and optional SDK version)"
task :new, :app_name, :sdk_version do |t, args|
  args.with_defaults(:sdk_version => "2.0p2")
  Dir.chdir(Rake.original_dir)

  config = Rally::AppSdk::AppConfig.new(args.app_name, args.sdk_version)
  Rally::AppSdk::AppTemplateBuilder.new(config).build
end

desc "Build a deployable app which includes all JavaScript and CSS resources inline"
task :build => [:jslint] do
  Dir.chdir(Rake.original_dir)
  Rally::AppSdk::AppTemplateBuilder.new(get_config_from_file).build_app_html
end

desc "Build a debug version of the app, useful for local development"
task :debug do
  Dir.chdir(Rake.original_dir)
  Rally::AppSdk::AppTemplateBuilder.new(get_config_from_file).build_app_html(true)
end

desc "Clean all generated output"
task :clean do
  Dir.chdir(Rake.original_dir)
  remove_files Rally::AppSdk::AppTemplateBuilder.get_auto_generated_files
end

desc "Deploy app to rally server"
task :deploy => [:build] do
  puts "Deploying to Rally..."

  config = get_config_from_file
  deploy_filename = Rally::AppSdk::AppTemplateBuilder::HTML

  deployr = Rally::AppSdk::Deployr.new(config, deploy_filename)

  deployr.login              # obtain session info

  if deployr.page_exists?
    deployr.update_page
  else
    deployr.create_page
  end

end

desc "Run jslint on all JavaScript files used by this app, can be enabled by setting ENABLE_JSLINT=true."
task :jslint do |t|
  if ENABLE_JSLINT
    Dir.chdir(Rake.original_dir)

    config = get_config_from_file
    files_to_run = config.javascript
    options = {
        "browser" => true,
        "predef" => ["Rally", "Ext"],
        "nomen" => false,
        "onevar" => false,
        "plusplus" => false
    }
    Rally::Jslint.run_jslint(files_to_run, options)
  end
end

module Rally
  module AppSdk

    # get params
    # return response or body/code?

    # Name: Deployr
    # Description: Class responsible for deploying Your app to a Rally server.  Already deployed? Your source
    #              will just be updated.  Otherwise, a new page and panel, with single layout, will be created.
    #              Note: Expects connection & credential info to be safely located (chmod 600) in config.json.
    # Config:
    #         config.json
    #         { 
    #          ...
    #          "server": "http://rally1.rallydev.com"         # or another instance
    #          "username": "someone@domain.com"               # rally login name
    #          "password": "S3cr3tS4uce"                      # rally login password
    #          "projectOid": 123456                           # project to deploy new page
    #         }
    #
    # Workflow:
    #
    #          Login > Create Page > Set Layout > Find Panel Type > Add Empty Panel > Upload Content
    #                              
    # Manual Testing: The following shell curl statements, developed as a prelude to this Class,
    #                 provide an alternate example for (manual) testing.  The uri's, schemes, and
    #                 params in this class were taken directly from the curl statements.  Note that
    #                 cookies.txt file used to pass around the session info
    # 
    #         LOGIN
    #          curl --location --cookie-jar cookies.txt --data-urlencode "j_username=<user>" --data-urlencode "j_password=<passwd>"
    #               https://demo01.rallydev.com/slm/platform/j_platform_security_check.op
    #         CREATE BLANK PAGE
    #           curl --cookie cookies.txt
    #                --data "name=foopage&type=DASHBOARD&timeboxFilter=none&pid=myhome&editorMode=create&cpoid=699319&projectScopeUp=false&projectScopeDown=false&version=0"
    #                "https://demo01.rallydev.com/slm/wt/edit/create.sp"
    #         SET PAGE LAYOUT (SINGLE)
    #           curl --cookie cookies.txt
    #             "https://demo01.rallydev.com/slm/dashboardSwitchLayout.sp?cpoid=699319&layout=SINGLE&dashboardName=myhome2246145&_slug=/custom/2246145"
    #         GET PANEL DEFINITION
    #           curl --cookie cookies.txt
    #                "https://demo01.rallydev.com/slm/panel/getCatalogPanels.sp?cpoid=&ignorePanelDefOids&gesture=getcatalogpaneldefs&slug=/custom/2246145"
    #         CREATE PANEL
    #           curl --location --cookie cookies.txt
    #                --data "panelDefinitionOid=739274&col=0&index=0&dashboardName=myhome224615"
    #                "https://demo01.rallydev.com/slm/dashboard/addpanel.sp?cpoid=699319&_slug=/custom/2246145"
    #         UPLOAD PANEL CONTENT
    #           curl --cookie cookies.txt
    #             --data "oid=2246150&dashboardName=myhome2246145&settings={'title':'my title','content':'my content'}"
    #             "https://demo01.rallydev.com/slm/dashboard/changepanelsettings.sp?cpoid=699319&_slug=/custom/2246145"
    #
    class Deployr

      def initialize(config, app_filename)
        @config = config                      # source of truth
        @server = config.server
        @port = "443"                         # SSL default port
        @username = config.username
        @password =config.password
        @project_oid = config.project_oid     # id of project to deploy app to
        @page_oid = config.page_oid           # id of page, associated to project, to deploy app to
        @tab_name = 'myhome'                  # internal name for 'My Home' application tab
        @app_name = config.name               # user provided name for their app
        @app_filename = app_filename          # locally built app
        @session_cookie = nil                 # required during all server communication; defined after login
      end

      # Determines if the app has already been uploaded to an existing page.
      # When a page is first deployed, the oid is saved in the config file.  This oid is
      # then used in subsequent deploys as a 'cached' value to simply update the page.  Even with
      # a cached value, we do a sanity check to verify the page _really_ exists.
      #
      # Developer Note:
      #   * direct 'page' url format: https://demo01.rallydev.com/#/{project_oid}d/custom/{dashboard_oid}
      #                               https://demo01.rallydev.com/#/699319d/custom/2248290
      def page_exists?
        return false if @page_oid.nil?  # not cached

        # no sleep for the wicked; verify page _still_ exists
        response = rally_get("/#/#{@project_oid}d/custom/#{@page_oid}")
        return true if response.class == Net::HTTPOK

        # TODO:  if pageOid is in prop file, but page DNE, then some cleanup is needed; give users url to del? auto del?
        puts "Warning: A previous page no longer exists.  Will continue creating a new page..."
        return false
      end

      def update_page
        puts "Updating Page '#{@app_name}'"
      end

      def create_page
        create_blank_page
        set_page_layout
        create_empty_panel
        puts "> Created page '#{@app_name}'"
        upload_app_into_panel
        puts "> Test Your App!"
      end


      # Login to Rally and obtain session id
      # Developer note: After posting login creds, Rally immediately issues a 302 redirect
      def login
        form_data = {"j_username" => @username, "j_password" => @password}
        response = rally_post("/slm/platform/j_platform_security_check.op", form_data, true)
        # essential for subsequent calls to rally to authenticate internally
        @session_cookie = get_session_cookie(response)
      end

      private

      # Extract Rally session cookie from response
      def get_session_cookie(response)
        response.get_fields('set-cookie').each do |cookie|
          return cookie if cookie =~ /JSESSIONID/
        end
      end

      # Create new page.
      # Developer Note: After creating a page, the oid of the page is in the resulting html.
      #                 We need this oid for future reference to the page.  Since html != xml,
      #                 regex to the rexue.  While this is a lava pit in general, the match
      #                 string needed is specific.   Also prevented gems e.g. nokogiri, etc.
      def create_blank_page
        form_data = {"name" => @app_name,
                     "type" => 'DASHBOARD',
                     "timeboxFilter" => "none",
                     "pid" => @tab_name,
                     "editorMode" => "create",
                     "cpoid" => @project_oid,
                     "version" => 0}
        response = rally_post("/slm/wt/edit/create.sp", form_data, false)

        # Looking for page OID html element: <input type="hidden" name="oid" value="2247529"/>
        match_data = /<input\ +type="hidden"\ +name="oid"\ +value="(\d+)"\/>/.match(response.body)

        # TODO: error handling if page Id not found
        @page_oid = match_data[1]

        # save page oid so subsequent deploys perform an update not create
        @config.add_persistent_property("pageOid", @page_oid)
      end

      # Create empty panel to place app source code
      def create_empty_panel

          # Lookup panel meta
          request_path = "/slm/panel/getCatalogPanels.sp"
          params = {:cpoid => @project_oid, :_slug => "/custom/#{@page_oid}", :ignorePanelDefOids => ''}  # empty :ignorePanelDefOids is required; omit and failure; not the droid looking for ;)
          path = construct_get(request_path, params)

          response = rally_get(path)

          panels = JSON.parse(response.body)
          custom_html_panel_oid = nil
          panels.each do |panel|
            custom_html_panel_oid = panel['oid'] if panel['title'] == "Custom HTML"
          end
          
          # Create new panel
          request_path = "/slm/dashboard/addpanel.sp"
          params = {:cpoid => @project_oid, :_slug => "/custom/#{@page_oid}"}
          path = construct_get(request_path, params)

          form_data = {"panelDefinitionOid" => custom_html_panel_oid,
                       "dashboardName" => "#{@tab_name}#{@page_oid}",
                       "col" => 0,
                       "index" => 0}
          response = rally_post(path, form_data)
          @panel_oid = JSON.parse(response.body)['oid']

      end

      # Uploads application source
      def upload_app_into_panel
          request_path = "/slm/dashboard/changepanelsettings.sp"
          params = {:cpoid => @project_oid, :_slug => "/custom/#{@page_oid}"}
          path = construct_get(request_path, params)

          app_html = File.read(@app_filename)
          panel_settings = {:title => @app_title, :content => app_html}

          form_data = {"oid" => @panel_oid,
                       "dashboardName" => "#{@tab_name}#{@page_oid}",
                       "settings" => JSON.generate(panel_settings)}

          response = rally_post(path, form_data)
      end

      # Set layout of page
      def set_page_layout
          request_path = "/slm/dashboardSwitchLayout.sp"
          params = {:cpoid => @project_oid, :layout => "SINGLE", :dashboardName => "#{@tab_name}#{@page_oid}", :_slug => "/custom/#{@page_oid}",}
          path = construct_get(request_path, params)

          response = rally_get(path)
      end

      # Perform HTTP GET to Rally with given uri path
      def rally_get(path)
        path = "/#{path}" if path[0] != '/'    # ensure prepended slash
        uri = URI.parse(@server + ":" + @port + path)
        http = Net::HTTP.new(uri.host, uri.port)
        http.use_ssl = true
        http.verify_mode = OpenSSL::SSL::VERIFY_NONE
        request = Net::HTTP::Get.new(uri.request_uri, {'Cookie' => "#{@session_cookie}"})
        resp = http.request(request)
        return resp
      end

      # Perform HTTP POST to Rally with given uri path
      def rally_post(path, form_data, login = false)
        path = "/#{path}" if path[0] != '/'    # ensure prepended slash
        uri = URI.parse(@server + ":" + @port + path)
        http = Net::HTTP.new(uri.host, uri.port)
        http.use_ssl = true
        http.verify_mode = OpenSSL::SSL::VERIFY_NONE
        headers = {'Cookie' => @session_cookie} unless login
        request = Net::HTTP::Post.new(uri.request_uri, headers)
        request.set_form_data(form_data)
        resp = http.request(request)
        return resp
      end

      # Utility to concatenate the GET request params after the given request path
      def construct_get(path, params)
          path = "#{path}?".concat(params.collect { |k,v| "#{k}=#{v}" }.join('&'))
      end

    end

    ## Builds the RallyJson config file as well as the JavaScript, CSS, and HTML
    ## template files.
    class AppTemplateBuilder

      CONFIG_FILE = "config.json"
      DEPLOY_DIR = 'deploy'
      JAVASCRIPT_FILE = "App.js"
      CSS_FILE = "app.css"
      HTML = "#{DEPLOY_DIR}/App.html"
      HTML_DEBUG = "App-debug.html"
      CLASS_NAME = "CustomApp"

      def self.get_auto_generated_files
        [HTML, HTML_DEBUG]
      end

      def initialize(config)
        @config = config
      end

      def build
        fail_if_file_exists get_template_files

        @config.javascript = JAVASCRIPT_FILE
        @config.css = CSS_FILE
        @config.class_name = CLASS_NAME

        create_file_from_template CONFIG_FILE, Rally::AppTemplates::CONFIG_TPL
        create_file_from_template JAVASCRIPT_FILE, Rally::AppTemplates::JAVASCRIPT_TPL, {:escape => true}
        create_file_from_template CSS_FILE, Rally::AppTemplates::CSS_TPL
      end

      def build_app_html(debug = false, file = nil)
        @config.validate

        assure_deploy_directory_exists()

        if file.nil?
          file = debug ? HTML_DEBUG : HTML
        end
        template = debug ? Rally::AppTemplates::HTML_DEBUG_TPL : Rally::AppTemplates::HTML_TPL
        template = populate_template_with_resources(template,
                                                    "JAVASCRIPT_BLOCK",
                                                    @config.javascript,
                                                    debug,
                                                    "\"VALUE\"",
                                                    3)

        template = populate_template_with_resources(template,
                                                    "STYLE_BLOCK",
                                                    @config.css,
                                                    debug,
                                                    "<link rel=\"stylesheet\" type=\"text/css\" href=\"VALUE\">",
                                                    2)

        create_file_from_template file, template, {:debug => debug, :escape => true}
      end

      def generate_js_inline_block
        template = populate_template_with_resources(Rally::AppTemplates::JAVASCRIPT_INLINE_BLOCK_TPL, "JAVASCRIPT_BLOCK", @config.javascript, false, nil, 3)
        replace_placeholder_variables template, {}
      end

      private

      def assure_deploy_directory_exists
        mkdir DEPLOY_DIR unless  File.exists?(DEPLOY_DIR)
      end

      def get_template_files
        [CONFIG_FILE, JAVASCRIPT_FILE, CSS_FILE]
      end

      def create_file_from_template(file, template, opts = {})
        populated_template = replace_placeholder_variables template, opts
        write_file file, populated_template
      end

      def write_file(path, content)
        puts "Creating #{path}..."
        File.open(path, "w") { |file| file.write(content) }
      end

      def populate_template_with_resources(template, placeholder, resources, debug, debug_tpl, indent_level)
        block = ""
        indent_level = 1 if debug
        indent = "    " * indent_level
        separator = ""

        resources.each do |file|
          if debug
            block << separator << debug_tpl.gsub("VALUE"){file}
            if is_javascript_file(file)
              separator = ",\n" + indent * 4
            else
              separator = "\n"
            end
          else
            IO.readlines(file).each do |line|
              block << indent << line.to_s.gsub(/\\'/, "\\\\\\\\'")
            end
          end
        end
        template.gsub(placeholder){block}
      end

      def replace_placeholder_variables(str, opts = {})
        # by default, we will esacpe single quotes
        escape = opts.has_key?(:escape) ? opts[:escape] : false
        debug = opts.has_key?(:debug) ? opts[:debug] : false

        str.gsub("APP_READABLE_NAME", @config.name).
            gsub("APP_NAME", escape ? escape_single_quotes(@config.name) : @config.name).
            gsub("APP_TITLE", @config.name).
            gsub("APP_SDK_VERSION", @config.sdk_version).
            gsub("APP_SDK_PATH", debug ? @config.sdk_debug_path : @config.sdk_path).
            gsub("DEFAULT_APP_JS_FILE", list_to_quoted_string(@config.javascript)).
            gsub("DEFAULT_APP_CSS_FILE", list_to_quoted_string(@config.css)).
            gsub("CLASS_NAME", @config.class_name)
      end

      def list_to_quoted_string(list)
        "\"#{list.join("\",\"")}\""
      end

      def escape_single_quotes(string)
        string.gsub("'", "\\\\\\\\'")
      end

      def is_javascript_file(file)
        file.split('.').last.eql? "js"
      end
    end


    ## Simple object wrapping the configuration of an App
    class AppConfig
      SDK_RELATIVE_URL = "/apps"
      SDK_ABSOLUTE_URL = "https://rally1.rallydev.com/apps"
      SDK_FILE = "sdk.js"
      SDK_DEBUG_FILE = "sdk-debug.js"

      attr_reader :name, :sdk_version
      attr_accessor :javascript, :css, :class_name
      attr_accessor :server, :username, :password, :project_oid, :page_oid

      def self.from_config_file(config_file)
        unless File.exist? config_file
          raise Exception.new("Could not find #{config_file}.  Did you run 'rake new[\"App Name\"]'?")
        end

        name = Rally::RallyJson.get(config_file, "name")
        sdk_version = Rally::RallyJson.get(config_file, "sdk")
        class_name = Rally::RallyJson.get(config_file, "className")
        javascript = Rally::RallyJson.get_array(config_file, "javascript")
        css = Rally::RallyJson.get_array(config_file, "css")
        server = Rally::RallyJson.get(config_file, "server")
        username = Rally::RallyJson.get(config_file, "username")
        password = Rally::RallyJson.get(config_file, "password")
        project_oid = Rally::RallyJson.get(config_file, "projectOid")
        page_oid = Rally::RallyJson.get(config_file, "pageOid")

        config = Rally::AppSdk::AppConfig.new(name, sdk_version, config_file)
        config.javascript = javascript
        config.css = css
        config.class_name = class_name
        config.server = server
        config.username = username
        config.password = password
        config.project_oid = project_oid
        config.page_oid = page_oid
        config
      end

      def initialize(name, sdk_version, file)
        @name = sanitize_string name
        @sdk_version = sdk_version
        @file = file
        @javascript = []
        @css = []
      end

      def javascript=(file)
        @javascript = (@javascript << file).flatten
      end

      def css=(file)
        @css = (@css << file).flatten
      end

      def add_persistent_property(name, value)
        current_config = File.read(@file)
        rconfig = JSON.parse(current_config)
        rconfig[name] = value
        File.open(@file, 'w') {|f| f.write(JSON.pretty_generate(rconfig))}
      end

      def validate
        @javascript.each do |file|
          raise Exception.new("Could not find JavaScript file #{file}") unless File.exist? file
        end

        @css.each do |file|
          raise Exception.new("Could not find CSS file #{file}") unless File.exist? file
        end

        class_name_valid = false
        @javascript.each do |file|
          file_contents = File.open(file, "rb").read
          if file_contents =~ /Ext.define\(\s*['"]#{class_name}['"]\s*,/
            class_name_valid = true
            break
          end
        end
        unless class_name_valid
          msg = "The 'className' property '#{class_name}' in #{Rally::AppSdk::AppTemplateBuilder::CONFIG_FILE} was not used when defining your app.\n" +
              "Please make sure that the 'className' property in #{Rally::AppSdk::AppTemplateBuilder::CONFIG_FILE} and the class name you use to define your app match!"
          raise Exception.new(msg)
        end

      end

      def sdk_debug_path
        "#{SDK_ABSOLUTE_URL}/#{@sdk_version}/#{SDK_DEBUG_FILE}"
      end

      def sdk_path
        "#{SDK_RELATIVE_URL}/#{@sdk_version}/#{SDK_FILE}"
      end
    end
  end

  class Jslint
    def self.check_for_jslint_support
      puts "Running jslint..."

      begin
        require 'rubygems'
        require 'jslint-v8'
      rescue Exception
        puts "In order to run jslint, you will need to install the 'jslint-v8' Ruby gem.\n" +
                 "You can do that by running:\n\tgem install jslint-v8\n"
        false
      end
    end

    def self.run_jslint(files_to_run, options)
      return unless check_for_jslint_support

      output_stream = STDOUT

      formatter = JSLintV8::Formatter.new(output_stream)
      runner = JSLintV8::Runner.new(files_to_run)
      runner.jslint_options.merge!(options)


      lint_result = runner.run do |file, errors|
        formatter.tick(errors)
      end

      output_stream.print "\n"
      formatter.summary(files_to_run, lint_result)
      raise "Jslint failed" unless lint_result.empty?
    end
  end

  ## Pure (very simple) Ruby JSON implementation
  module RallyJson
    class << self

      def get(file, key)
        get_value(file, key)
      end

      def get_array(file, key)
        get_array_values(file, key)
      end

      private
      def get_value(file, key)
        File.open(file, "r").each_line do |line|
          if line =~ /^\s*"#{key}"\s*:\s*"(.*)".*$/ || line =~ /^\s*"#{key}"\s*:\s*(.*)\s*$/
            return $1
          end
        end
        nil
      end

      def get_array_values(file, key)
        values = []

        in_block = false
        File.open(file).each_line do |line|
          in_block = true if line =~ /^\s*"#{key}"\s*:\s*\[/

          if in_block
            if line =~ /^\s*"#{key}"\s*:\s*\[(.*)\]/
              add_prop values, $1, key
            elsif line =~ /^\s*(".*")[,\]]?/
              add_prop values, $1, key
            end
          end

          in_block = false if in_block && line =~ /.*\][,]?/
        end

        values
      end

      def add_prop(array, values, exclude)
        values.split(',').each do |value|
          value = value.chomp.strip
          value = value.chomp[1..(value.length-2)]
          array << value unless value == exclude || value.nil?
        end
      end

    end
  end

  module AppTemplates
    ## Templates
    JAVASCRIPT_TPL = <<-END
Ext.define('CLASS_NAME', {
    extend: 'Rally.app.App',
    componentCls: 'app',

    launch: function() {
        //Write app code here
    }
});
    END

    JAVASCRIPT_INLINE_BLOCK_TPL = <<-END
JAVASCRIPT_BLOCK
            Rally.launchApp('CLASS_NAME', {
                name: 'APP_NAME'
            });
    END

    HTML_DEBUG_TPL = <<-END
<!DOCTYPE html>
<html>
<head>
    <title>APP_TITLE</title>

    <script type="text/javascript" src="APP_SDK_PATH"></script>

    <script type="text/javascript">
        Rally.onReady(function() {
            Rally.loadScripts([
                JAVASCRIPT_BLOCK
            ], function() {
                Rally.launchApp('CLASS_NAME', {
                    name: 'APP_NAME'
                })
            }, true);
        });
    </script>

STYLE_BLOCK
</head>
<body></body>
</html>
    END

    HTML_TPL = <<-END
<!DOCTYPE html>
<html>
<head>
    <title>APP_TITLE</title>

    <script type="text/javascript" src="APP_SDK_PATH"></script>

    <script type="text/javascript">
        Rally.onReady(function() {
#{JAVASCRIPT_INLINE_BLOCK_TPL}        });
    </script>

    <style type="text/css">
STYLE_BLOCK    </style>
</head>
<body></body>
</html>
    END

    CONFIG_TPL = <<-END
{
    "name": "APP_READABLE_NAME",
    "className": "CustomApp",
    "sdk": "APP_SDK_VERSION",
    "javascript": [
        DEFAULT_APP_JS_FILE
    ],
    "css": [
        DEFAULT_APP_CSS_FILE
    ],
    "server": "http://rally1.rallydev.com",
    "username": "you@domain.com",
    "password": "S3cr3t",
    "projectOid": 12345
}
    END

    CSS_TPL = <<-END
.app {
     /* Add app styles here */
}
    END
  end
end

## Helpers
def get_config_from_file
  config_file = Rally::AppSdk::AppTemplateBuilder::CONFIG_FILE
  Rally::AppSdk::AppConfig.from_config_file(config_file)
end

def remove_files(files)
  files.map { |f| File.delete(f) if File.exists?(f) }
end

def fail_if_file_exists(files)
  files.each do |file|
    raise Exception.new "I found an existing app file - #{file}.  If you want to create a new app, please remove this file!" if File.exists? file
  end
end

def sanitize_string(value)
  value.gsub(/[^a-zA-Z0-9 \-_\.']/, "")
end
