/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
// Place all the behaviors and hooks related to the matching controller here.
// All this logic will automatically be available in application.js.
// You can use CoffeeScript in this file: http://coffeescript.org/

const getTrelloToken = function () {
  const token = Cookies.get("token");
  if (!!token) {
    return token;
  }

  if (!!window.location.hash) {
    const key_value = window.location.hash.substring(1).split("=");
    if (key_value[0] === "token") {
      return key_value[1];
    }
  }
};

const addBoards = function (boards) {
  const selectElement = document.getElementById("boardSelect");
  if (selectElement.disabled) {
    selectElement.disabled = false;
  }
  while (selectElement.length > 0) {
    selectElement.remove(0);
  }

  return Array.from(boards).map((board, i) =>
    selectElement.add(new Option(board["name"], board["id"]))
  );
};

const loadBoards = function (resp) {
  const token = getTrelloToken();
  return window.Trello.get(
    "/members/me/boards",
    { token: token, filter: "open" },
    (resp) => addBoards(resp)
  );
};

const drawCard = function (card, progressValue) {
  if (progressValue < 1) {
    progressValue = progressValue * 100;
  }

  const url = card.shortUrl;
  const startDate = card.start;
  const endDate = card.due;
  if (isUndefined(startDate) || isUndefined(endDate)) {
    return;
  }

  const momentStartDate = moment(startDate);
  const momentEndDate = moment(endDate);
  const dateOnly = momentEndDate.diff(momentStartDate, "days") < 14;
  const formattedStartDate = formatDatetime(momentStartDate, dateOnly);
  const formattedEndDate = formatDatetime(momentEndDate, dateOnly);

  const content = `\
<div class="panel panel-default card" id="${card.id}">
  <div class="panel-heading">
    <h3 class="panel-title">
      <a href="${url}" target="_blank">${card.name}</a>
    </h3>
  </div>
  <div class="panel-body">
    <div class="progress" data-date-start="${startDate}" data-date-end="${endDate}">
      <div class="progress-bar progress-bar-success positive" role="progressbar" style="width: ${progressValue}%;">
        <span>
        ${progressValue}%
        </span>
      </div>
      <div class="progress-bar progress-bar-danger negative" role="progressbar" style="width: 0.0%;">
        <span></span>
      </div>
    </div>
  </div>
  <div class="panel-footer">
    <span class="start-date"> 
      ${formattedStartDate}
    </span>
    <span class="end-date"> 
      ${formattedEndDate}
    </span>
  </div>
</div>\
`;

  return window.visDataSet.add({
    id: card.id,
    content,
    start: moment(startDate),
    end: moment(endDate),
  });
};

const populateProgressField = function (card, progressFieldId) {
  let progressValue;
  const progressFields = card.customFieldItems.filter(
    (field) => field.idCustomField === progressFieldId
  );

  if (progressFields.length > 0) {
    progressValue = parseFloat(progressFields[0].value.number);
  } else {
    progressValue = 0;
  }

  return drawCard(card, progressValue);
};

const loadCards = function (cards, customFields) {
  let progressFieldId;
  const progressFields = customFields.filter(
    (field) => field.name === "progress"
  );
  if (progressFields.length > 0) {
    progressFieldId = progressFields[0].id;
  } else {
    progressFieldId = undefined;
  }

  return Array.from(cards).map((card, i) =>
    trelloWrapper(`/cards/${card.id}`, { customFieldItems: true }, (card) =>
      populateProgressField(card, progressFieldId)
    )
  );
};

var isUndefined = (obj) => !obj;

var trelloWrapper = function (url, params, func) {
  if (params == null) {
    params = undefined;
  }
  if (func == null) {
    func = undefined;
  }
  if (isUndefined(func)) {
    func = params;
    params = undefined;
  }

  if (isUndefined(params)) {
    params = {};
  }

  params["token"] = getTrelloToken();
  return window.Trello.get(url, params, func);
};

const loadTimeline = function () {
  window.visDataSet.clear();
  const boardId = document.getElementById("boardSelect").value;

  return trelloWrapper(`/boards/${boardId}/customFields`, (customFields) =>
    trelloWrapper(`/boards/${boardId}/cards`, (cards) =>
      loadCards(cards, customFields)
    )
  );
};

$(document).ready(function () {
  visInit();
});

$(document).on("click", "#load-timline", function (event) {
  const token = getTrelloToken();
  if (!token) {
    return window.Trello.authorize({
      name: "Trello timeline",
      scope: { read: true, write: false, account: false },
      success: loadBoards,
    });
  } else {
    return loadBoards();
  }
});

$(document).on("input", "#boardSelect", (event) => loadTimeline());

const visOnAdd = (event, properties, senderId) =>
  Array.from(properties.items).map((id, i) =>
    setTimeout(() => format_project(id), 500)
  );

var visInit = function () {
  window.visDataSet = new vis.DataSet();
  window.visDataSet.on("add", visOnAdd);

  const viz = $("#visualization");
  if (viz.length > 0 && viz.children().length === 0) {
    let visTimeline;
    const container = viz[0];
    const options = {
      zoomable: false,
      start: moment().subtract(1, "months"),
      end: moment().add(1, "months"),
      selectable: false,
    };
    return (visTimeline = new vis.Timeline(
      container,
      window.visDataSet,
      options
    ));
  }
};

var formatDatetime = function (datetime, dateOnly) {
  let datetime_format;
  if (dateOnly == null) {
    dateOnly = false;
  }
  const localeData = moment.localeData();
  const dateFormat = localeData.longDateFormat("L");
  if (dateOnly) {
    datetime_format = `${dateFormat}`;
  } else {
    const timeFormat = localeData.longDateFormat("LT");
    datetime_format = `${dateFormat} ${timeFormat}`;
  }

  return datetime.format(datetime_format);
};

const format_projects = (id) => window.visDataSet.forEach(format_project);

var format_project = function (id) {
  const project = $(`#${id}`);

  const start_datetime = moment(
    $(project).find(".progress").data("date-start")
  );
  const end_datetime = moment($(project).find(".progress").data("date-end"));

  const timestamps = $.map(project.find(".bar-step"), (m) =>
    get_timestamp(get_data(m, "data-date"))
  );
  const width = project.find(".progress").width();

  const min_timestamp = Math.min.apply(null, timestamps);
  const max_timestamp = Math.max.apply(null, timestamps);
  project.find(".bar-step").each(function (index) {
    const timestamp = get_timestamp(get_data(this, "data-date"));

    let shift =
      ((timestamp - min_timestamp) / (max_timestamp - min_timestamp)) * width;
    if (shift === width) {
      const text_width = $(this).find(".bar-text").width();
      shift = shift - text_width;
    }

    return $(this).css("margin-left", shift + "px");
  });

  return update_progress_bars(project);
};

var update_progress_bars = function (project) {
  const current_datetime = moment();
  const current_progress = parseFloat(
    $(project).find(".progress-bar.positive span").text()
  );
  const start_datetime = moment(
    $(project).find(".progress").data("date-start")
  );
  const end_datetime = moment($(project).find(".progress").data("date-end"));
  const expected_progress = get_progress(
    start_datetime,
    current_datetime,
    end_datetime
  );
  let progress_diff = round(expected_progress - current_progress);
  if (progress_diff > 100.0) {
    progress_diff = round(100.0 - current_progress);
  }
  $(project).find(".progress-bar.negative span").text(`${progress_diff}%`);
  return $(project).find(".progress-bar.negative").width(`${progress_diff}%`);
};

var round = (number) => Math.round(number * 100) / 100;

var get_progress = function (start, current, end) {
  if (start.isBefore(end)) {
    return round(((current - start) / (end - start)) * 100);
  } else {
    return 0.0;
  }
};

var get_timestamp = (date_string) =>
  Date.parse(date_string.replace(" UTC", "Z"));

var get_data = (obj, key) => $(obj).attr(key);
