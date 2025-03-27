$("#role").on("change", function () {
  var role = $(this).val();
  if (role) {
    var actionUrl = baseUrl + "/api/permission_role/" + role;
    var method = "GET";

    $.ajax({
      url: actionUrl,
      method: method,
      dataType: "json",
      beforeSend: function () {},
      success: function (response) {
        toastr.remove();
        if (response.status) {
          $("#user").empty();

          if (response.data.length > 0) {
            $("#user").append(
              "<option value=''> ---- Select User ----</option>"
            );
            $.each(response.data, (key, val) => {
              $("#user").append(
                "<option value='" + val.id + "'>" + val.name + "</option>"
              );
            });
          } else {
            $("#user").append(
              "<option value=''> ---- Select User ----</option>"
            );
          }
        } else {
          toastr.error(response.message);
        }
      },
      error: function (response) {
        toastr.remove();
        toastr.error(response.message);
      },
    });
  } else {
    $("#user").empty();
    $("#user").append("<option value=''> ---- Select User ----</option>");
    toastr.error("Please select a role");
  }
});

$(".result-checkbox").on("change", function () {
  var index = $(this).data("index");

  // Uncheck all other checkboxes with the same data-index
  $('.result-checkbox[data-index="' + index + '"]')
    .not(this)
    .prop("checked", false);
  // Initialize count
  var count = 0;
  // Find the closest parent card and then locate the hidden input with the class 'check'
  var $checkInput = $(this).closest(".accordion-item").find(".check");
  var countId = $checkInput.val();

  var $submoduleCount = $(this)
    .closest(".accordion-item")
    .find(".submodulecount");

  var submoduleCountId = $submoduleCount.val();

  $(this)
    .closest(".accordion-item")
    .find('input[type="checkbox"]')
    .each(function () {
      if ($(this).prop("checked")) {
        count++;
      }
    });

  $("#count" + countId).text(`${count} / ${submoduleCountId}`);
});

$("#user").on("change", function () {
  var role = $("#role").val();
  var user = $(this).val();

  var formData = {
    roleId: role,
    userId: user,
  };

  var actionUrl = "/api/getPermissions";
  var method = "POST";

  $.ajax({
    url: baseUrl + actionUrl,
    method: method,
    data: JSON.stringify(formData), // Send form data as JSON
    contentType: "application/json", // Set the content type to JSON
    dataType: "json",
    headers: {
      Accept: "application/json",
    },
    beforeSend: function () {},
    success: function (response) {
      if (response.status) {
        var selectedPermissions =
          response.getPermission[0].permissions_id.split(",");
        var selectedcheck = response.selectedcheck;

        // Uncheck all checkboxes
        $('input[type="checkbox"]').prop("checked", false);

        // Check checkboxes based on the selectedPermissions array
        selectedPermissions.forEach(function (permissionId) {
          var checkboxClass = "result-" + permissionId;
          $("." + checkboxClass).prop("checked", true);
        });

        // Check if selectedcheck is an array
        for (const key in response.selectedcheck) {
          if (response.selectedcheck.hasOwnProperty(key)) {
            const countRole = response.selectedcheck[key];
            $("#count" + key).text(countRole);
          }
        }
      } else {
        $('input[type="checkbox"]').prop("checked", false);
      }
    },
    error: function (response) {},
  });
});

$("#roleForm").validate({
  debug: false,
  errorClass: "authError",
  errorElement: "span",
  rules: {
    role: {
      required: true,
    },
    user: {
      required: true,
    },
    // Add validation rules for other fields if needed
  },
  messages: {
    role: {
      required: "Please select a role.",
    },
    user: {
      required: "Please select a user.",
    },
    // Add custom error messages for other fields if needed
  },
  submitHandler: function (form) {
    // Your existing submit code here
    var roleId = $("#role").val();
    var userInfo = $("#user").val();
    var selectedPermissions = [];

    $('input[type="checkbox"]:checked').each(function () {
      var permissionId = $(this).val();
      selectedPermissions.push(permissionId);
    });

    // Check if at least one permission is selected
    if (selectedPermissions.length < 1) {
      toastr.error("Please select at least one or more access.");
      return;
    }

    // Show Toastr "Please wait" message
    // toastr.info("Please wait...", {
    //   timeOut: 0,
    //   extendedTimeOut: 0,
    //   closeButton: false,
    //   tapToDismiss: false,
    // });

    var formData = {
      roleId: roleId,
      userId: userInfo,
      permissions: selectedPermissions,
    };

    var actionUrl = "/api/permission_role";
    var method = "POST";

    $.ajax({
      url: baseUrl + actionUrl,
      method: method,
      data: JSON.stringify(formData), // Send form data as JSON
      contentType: "application/json", // Set the content type to JSON
      dataType: "json",
      headers: {
        Accept: "application/json",
      },
      beforeSend: function () {},
      success: function (response) {
        if (response.status) {
          toastr.success(response.message);
        } else {
          toastr.error(response.message);
        }
      },
      error: function (response) {},
    });
  },
  highlight: function (element, errorClass) {
    $(element).removeClass(errorClass);
  },
});

// Your existing click event code
$("#submitForm").on("click", function (e) {
  e.preventDefault();
  $("#roleForm").submit(); // This will trigger the validation
});
