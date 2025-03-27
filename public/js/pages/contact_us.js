var table = $("#contactus_table").DataTable({
    searching: true,
    ordering: false,
    aLengthMenu: [
      [10, 15, 25, 50, 100, -1],
      [10, 15, 25, 50, 100, "All"],
    ],
    language: { lengthMenu: "Show _MENU_" },
    dom:
      "<'row mb-2'" +
      "<'col-sm-6 d-flex align-items-center justify-content-start dt-toolbar'l>" +
      "<'col-sm-6 d-flex align-items-center justify-content-end dt-toolbar'f>" +
      ">" +
      "<'table-responsive'tr>" +
      "<'row'" +
      "<'col-sm-12 col-md-5 d-flex align-items-center justify-content-center justify-content-md-start'i>" +
      "<'col-sm-12 col-md-7 d-flex align-items-center justify-content-center justify-content-md-end'p>" +
      ">",
    processing: true,
    serverSide: true,
    serverMethod: "POST",
    ajax: {
      url: baseUrl + "/api/getContactUs",
      type: "POST",
      headers: {
        Accept: "application/json",
      },
      dataSrc: function (json) {
        return json.data;
      },
    },
    columns: [
      { data: "full_name", className: "text-center fs-6" },
      { data: "email", className: "text-center fs-6" },
      { data: "phone_no", className: "text-center fs-6" },
      { data: "reason", className: "text-center fs-6" },
      { data: "created_at", className: "text-center fs-6" },
    ],
  });

  table.on("draw", function () {
    if ($('[data-bs-toggle="tooltip"]') !== undefined) {
      //$('[data-bs-toggle="tooltip"]').tooltip(); // Reinitialize tooltips
    }
  });