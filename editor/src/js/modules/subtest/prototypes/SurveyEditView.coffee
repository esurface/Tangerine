class SurveyEditView extends Backbone.View

  className: "SurveyEditView"

  events:
    'click .add_question'        : 'toggleAddQuestion'
    'click .add_question_cancel' : 'toggleAddQuestion'
    'click .add_question_add'    : 'addQuestion'
    'keypress #question_name'    : 'addQuestion'

    'change #asset-file' : 'updateFiles'
    'change .replace-asset'  : 'replaceAsset'
    'change input.asset'      : 'updateAssets'
    'change .asset-name'      : 'changeAssetName'
    'click .remove-asset'     : 'removeAsset'
    'click #assets'     : 'showAssets'

  initialize: ( options ) ->
    @model = options.model
    @parent = options.parent
    @subtests = options.subtests
    @model.questions = new Questions
    @questionsEditView = new QuestionsEditView
      questions : @model.questions

    Utils.working true
    @model.questions.fetch
      key: "q" + @model.get "assessmentId"
      success: =>
        Utils.working false
        @questionsEditView.questions = new Questions(@model.questions.where {subtestId : @model.id  })
        @questionsEditView.questions.ensureOrder()

        @questionsEditView.on "question-edit", (questionId) => @trigger "question-edit", questionId
        @questionsEditView.questions.on "change", @renderQuestions
        @renderQuestions()
      error: (a, b) =>
        Utils.working false
        Utils.midAlert "Error<br>Could not load questions<br>#{a}, #{b}", 5000

  toggleAddQuestion: =>
    @$el.find("#add_question_form, .add_question").fadeToggle 250, =>
      if @$el.find("#add_question_form").is(":visible")
        @$el.find("#question_prompt").focus()
    return false

  addQuestion: (event) ->
    
    if event.type != "click" && event.which != 13
      return true
    
    newAttributes = $.extend Tangerine.templates.get("questionTemplate"),
      subtestId    : @model.id
      assessmentId : @model.get "assessmentId"
      id           : Utils.guid()
      order        : @questionsEditView.questions.length
      prompt       : @$el.find('#question_prompt').val()
      name         : @$el.find('#question_name').val().safetyDance()

    nq = @questionsEditView.questions.create newAttributes
    @renderQuestions()
    @$el.find("#add_question_form input").val ''
    @$el.find("#question_prompt").focus()

    return false

  isValid: -> true

  fileSize: (bytes, si = false) ->
    threshold = if si? then 1000 else 1024

    if Math.abs(bytes) < threshold
      return bytes + ' B'

    units = if si?
      ['kB','MB','GB','TB','PB','EB','ZB','YB']
    else
      ['KiB','MiB','GiB','TiB','PiB','EiB','ZiB','YiB']
    u = -1
    while Math.abs(bytes) >= threshold && u < units.length - 1
      bytes /= threshold
      u++

    "#{bytes.toFixed(1)}#{units[u]}"

  save: (options) ->

    options.questionSave = if options.questionSave? then options.questionSave else true

    @model.set
      "gridLinkId"    : @$el.find("#link_select option:selected").val()
      "autostopLimit" : parseInt(@$el.find("#autostop_limit").val()) || 0
      "focusMode"     : @$el.find("#focus_mode input:checked").val() == "true"

    if @model.get("gridLinkId") != "" && @model.questions?
      linkedQuestions = []
      for question in @model.questions.where {"subtestId" : @model.id}
        applicable = question.getNumber("linkedGridScore") != 0 && @itemNumberByLinkId[@model.get("gridLinkId")]?
        if applicable && question.get("linkedGridScore") > @itemNumberByLinkId[@model.get("gridLinkId")]
          linkedQuestions.push question.get("name")

      if linkedQuestions.length > 0
        alert "Unreachable question warning\n\nThe linked grid contains fewer items than question#{("s" if linkedQuestions.length>1)||""}: #{linkedQuestions.join(", ")} demand#{("s" if not linkedQuestions.length>1)||""}."

    # blank out our error queues
    notSaved = []
    emptyOptions = []
    requiresGrid = []
    duplicateVariables = []

    variableNames = {}

    # check for "errors"
    for question, i in @questionsEditView.questions.models

      if question.get("name") != ""
        variableNames[question.get("name")] = 0 if not _.isNumber(variableNames[question.get("name")])
        variableNames[question.get("name")]++

      noDynamicOptions = !~question.getString('displayCode').indexOf('setOptions')
      noOptions = question.get("options")?.length == 0
      isntOpen = question.get("type") != "open"
      isntAv = question.get("type") != "av"
      if isntOpen && noOptions && noDynamicOptions && isntAv
        emptyOptions.push i + 1

        if options.questionSave
          if not question.save()
            notSaved.push i
          if question.has("linkedGridScore") && question.get("linkedGridScore") != "" && question.get("linkedGridScore") != 0 && @model.has("gridLinkId") == "" && @model.get("gridLinkId") == ""
            requiresGrid.push i

    for name, count of variableNames
      duplicateVariables.push name if count != 1

    # display errors
    aWarnings = []
    if notSaved.length != 0
      Utils.midAlert "Error<br><br>Questions: <br>#{notSaved.join(', ')}<br>not saved"
    if options.questionSave && emptyOptions.length != 0
      plural = emptyOptions.length > 1
      _question = if plural then "Questions" else "Question"
      _has      = if plural then "have" else "has"
      aWarnings.push "- #{_question} #{emptyOptions.join(' ,')} #{ _has } no options."
    if requiresGrid.length != 0
      plural = emptyOptions.length > 1
      _question = if plural then "Questions" else "Question"
      _require  = if plural then "require" else "requires"
      aWarnings.push "- #{ _question } #{requiresGrid.join(' ,')} #{ _require } a grid to be linked to this test."
    if duplicateVariables.length != 0
      aWarnings.push "- The following variables are duplicates\n #{duplicateVariables.join(', ')}"

    if aWarnings.length != 0
      tWarnings = aWarnings.join("\n\n")
      alert "Warning\n\n#{tWarnings}"


  onClose: ->
    @questionsListEdit?.close()

  renderQuestions: =>
    @questionsEditView?.render()

  showAssets: =>
    $('#asset-manager').toggle()

  render: ->
      
#    addQuestionSelect = "<select id='add_question_select'>"
#    for template in Tangerine.templates.optionTemplates
#      addQuestionSelect += "<option value='#{template.name}'>#{template.name}</option>"
#    addQuestionSelect += "</select>"

    gridLinkId = @model.get("gridLinkId") || ""
    autostopLimit = parseInt(@model.get("autostopLimit")) || 0
    focusMode = @model.getBoolean("focusMode")

    @$el.html "
      <div id='assets'>
      <h2>Assets</h2>
      <section id='asset-manager'>
      </section>

      <div class='label_value'>
        <label for='autostop_limit' title='The survey will discontinue after any N consecutive questions have been answered with a &quot;0&quot; value option.'>Autostop after N incorrect</label><br>
        <input id='autostop_limit' type='number' value='#{autostopLimit}'>
      </div>
      <div class='label_value'>
          <label title='Displays one question at a time with next and previous buttons.'>Focus mode</label>
          <div id='focus_mode' class='buttonset'>
            <label for='focus_true'>Yes</label>
            <input name='focus_mode' type='radio' value='true' id='focus_true' #{'checked' if focusMode}>
            <label for='focus_false'>No</label>
            <input name='focus_mode' type='radio' value='false' id='focus_false' #{'checked' if not focusMode}>
          </div>

      </div>
      <div id='grid_link'></div>
      <div id='asset-manager-container'></div>
      <div id='questions'>
        <h2>Questions</h2>
        <div class='menu_box'>
          <div id='question_list_wrapper'><img class='loading' src='images/loading.gif'><ul></ul></div>
          <button class='add_question command'>Add Question</button>
          <div id='add_question_form' class='confirmation'>
            <div class='menu_box'>
              <h2>New Question</h2>
              <label for='question_prompt'>Prompt</label>
              <input id='question_prompt'>
              <label for='question_name'>Variable name</label>
              <input id='question_name' title='Allowed characters: A-Z, a-z, 0-9, and underscores.'><br>
              <button class='add_question_add command'>Add</button><button class='add_question_cancel command'>Cancel</button>
            </div>
          </div>
        </div>
      </div>"

    @$el.find("#question_list_wrapper .loading").remove()
    @questionsEditView.setElement @$el.find("#question_list_wrapper ul")

    @renderQuestions()
    @renderAssetManager()

    # get linked grid options
    subtests = new Subtests
    subtests.fetch
      key: "s" + @model.get "assessmentId"
      success: (collection) =>
        collection = collection.where
          prototype    : 'grid' # only grids can provide scores

        linkSelect = "
          <div class='label_value'>
            <label for='link_select'>Linked to grid</label><br>
            <div class='menu_box'>
              <select id='link_select'>
              <option value=''>None</option>"
        for subtest in collection
          @itemNumberByLinkId = {} if not @itemNumberByLinkId?
          @itemNumberByLinkId[subtest.id] = subtest.get("items").length
          linkSelect += "<option value='#{subtest.id}' #{if (gridLinkId == subtest.id) then 'selected' else ''}>#{subtest.get 'name'}</option>"
        linkSelect += "</select></div></div>"
        @$el.find('#grid_link').html linkSelect

# save question. called when an asset is changed. Seems important to save then.
  saveModel: ->
    @model.save null,
      success: =>
        Utils.midAlert "Image saved."


  updateFiles: (e) ->
    files = e.target.files
    file = files[0]

    if files && file
      reader = new FileReader()

      reader.onload = (readerEvt) =>
        img64 = btoa(readerEvt.target.result)
        @addAsset
          id      : Utils.guid()
          name    : file.name
          imgData : img64
          type    : file.type

      reader.readAsBinaryString(file)

# when an asset's name is changed
  changeAssetName: (e) ->
    index = @getNumber e, 'data-index'
    name = @getString e

    assets = @model.getArray('assets')
    assets[index].name = name
    @model.set('assets', assets)
    @saveModel()



  addAsset: (asset, index) ->
# clean
    newAsset =
      name    : asset.name
      imgData : asset.imgData
      type    : asset.type

    # update model
    assets = @model.getArray("assets")
    if index?
      assets[index] = newAsset
    else
      assets.push(newAsset)
    @model.set("assets", assets)
    @saveModel()

    # update screen
    @renderAssetManager()

  replaceAsset: (e) ->
    console.log "replacing asset"
    index = $(e.target).attr('data-index')
    files = e.target.files
    file = files[0]

    if files && file
      reader = new FileReader()

      reader.onload = (readerEvt) =>
        img64 = btoa(readerEvt.target.result)
        @insertAsset index,
          name    : file.name
          imgData : img64
          type    : file.type

      reader.readAsBinaryString(file)


  insertAsset: (index, asset) ->

    assets = @model.getArray('assets')
    assets[index] = asset
    @model.set('assets', assets)

    @saveModel()
    # update screen
    @renderAssetManager()


  removeAsset: (e) ->
    index = @getNumber e, 'data-index'

    assets = @model.getArray('assets')
    assets.splice(index, 1)
    @model.set('assets', assets)

    @saveModel()
    # update screen
    @renderAssetManager()

  renderAssetManager: ->

    if @model.getArray('assets').length is 0
      listHtml = '<p>Nothing uploaded yet.</p>'
    else
      listHtml = @model.getArray('assets').map((el, i) ->
        "<tr>
          <td><div class='av-image-container'><img class='asset-thumb' src='data:#{el.type};base64,#{el.imgData}'></div>
            #{@fileSize(el.imgData.length)}</td>
          <td><input class='asset-name' data-index='#{i}' value='#{_(el.name).escape()}'></td>
          <td><button class='command' style='position: relative; overflow: hidden; margin: 10px; '><input type='file' class='replace-asset'  data-index='#{i}' style='position: absolute;top: 0;right: 0;margin: 0;padding: 0;font-size: 20px;cursor: pointer;opacity: 0;filter: alpha(opacity=0);'>Replace</button></td>
          <td><button class='remove-asset command' data-index='#{i}'>Remove</button></td>

        </tr>"
      , @).join('')

      listHtml = "
        <table id='asset-table'>
          <tr><th>Thumbnail</th><th>Name</th><th></th></tr>
          #{listHtml}
        </table>
      "

    @$el.find('#asset-manager').html "
      <section>
      <h3>Assets</h3>
        <input id='asset-file' type='file' accept='image/gif, image/jpeg, image/png, audio/mpeg' style='border: none;font-size: 16px;'>
        #{listHtml}
      </section>
    "
    @resizeAssetThumbs()

  resizeAssetThumbs: ->
    @$el.find('img.asset-thumb').on 'load', () ->
      ratio  = $(@).width() / $(@).height()
      pratio = $(@).parent().width() / $(@).parent().height()

      if (ratio < pratio)
        css = width:'auto', height:'100%'
      else
        css = width:'100%', height:'auto'

      $(@).css(css)

      if (ratio < pratio)
        $(@).parent().width($(@).width())
      else
        $(@).parent().height($(@).height())

# Utility to get the value or attribute contained in a dom element.
# See: @getNumber and @getString
  getAttribute: (target, attribute) ->
    itsAjQueryEvent = target instanceof jQuery.Event
    itsADomElement  = target instanceof Node
    itsAString      = _(target).isString()

    $target = if itsAjQueryEvent
      $(target.target)
    else if itsADomElement
      $(target)
    else if itsAString
      @$el.find(target)

    return $target.val() unless attribute?
    return $target.attr(attribute)

# Utility to get a number from a dom element
  getNumber: (target, attribute) ->
    return Number @getAttribute( target, attribute )

# Utility to get a string
# just for consistency, getAttribute always returns a string
  getString: (target, attribute) ->
    return @getAttribute( target, attribute )

