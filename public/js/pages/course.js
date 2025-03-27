

var input = document.getElementById('what_you_will_get');
var tagify = new Tagify(input);
tagify.on('change', function() {
    var tagData = tagify.value; // This gives an array of tag objects
    var commaSeparatedValues = tagData.map(tag => tag.value).join(', ');
 // Example Output: "sdsd, bhuis"
});

var table = $("#data_table").DataTable({
    "searching": true,
    "ordering": false,
    "rowReorder": {
          selector: 'td:not(.no-reorder)',  // Makes the entire row draggable
            update: false    // Prevents auto-updating; we'll handle it manually
        },
    "aLengthMenu": [
        [10, 15, 25, 50, 100, -1],
        [10, 15, 25, 50, 100, "All"]
    ],
    "language": {
        "lengthMenu": "Show _MENU_",
    },
    "dom": "<'row mb-2'" +
        "<'col-sm-6 d-flex align-items-center justify-conten-start dt-toolbar'l>" +
        "<'col-sm-6 d-flex align-items-center justify-content-end dt-toolbar'f>" +
        ">" +
        "<'table-responsive'tr>" +
        "<'row'" +
        "<'col-sm-12 col-md-5 d-flex align-items-center justify-content-center justify-content-md-start'i>" +
        "<'col-sm-12 col-md-7 d-flex align-items-center justify-content-center justify-content-md-end'p>" +
        ">",

    "processing": true,
    "serverSide": true,
    "serverMethod": "post",
    "ajax": {
        "url":baseUrl +"/api/getCourses",
        "accept": "application/json",
        "data": function (d) {
            let formData = $("#filterForm").serializeArray().reduce((obj, item) => {
                obj[item.name] = item.value;
                return obj;
            }, {});

            return Object.assign(d, formData); // Merge filter values into DataTables request
        },
        "beforeSend": function (xhr) {

        },
    },
    //
    // sample_video,trailor_video
    // course_name,master_name,instructer,short_description,
    // course_cost,duration,type,no_of_modules,category,subcategory,

    "columns": [
        { data:"id", className: "text-center fs-6", visible:false},{
        data: "ordering",
        className:"text-center"
    },{
        data: "course_name",
        className:"text-center"
    },
    // {
    //     data: "short_description"
    // },
    {
        data: "course_cost"
    },
    {
        data: "duration"
    },
    // {
    //     data: "type"
    // },
    // {
    //     data: "no_of_modules"
    // },
    {
        data: "category"
    },
    {
        data: "master_name"
    },

    {
        data: "status",
        className:"no-reorder",
        visible:isActionVisible
    },

    {
        data: "trending_flag",
        className:"no-reorder",
        visible:isActionVisible
    },
    // {
    //     data: "created_by"
    // },

    {
        data: "updated_by"
    },

    {
        data: "action",
        searchable: false,
        orderable: false,
        className:"text-center no-reorder",
        visible:isActionVisible
    }
    ]
});

table.on('row-reorder', function (e, diff, edit) {
    if (diff.length) {
      let reorderedData = [];

      // Loop through the reordered rows (from 'diff')
      for (let i = 0; i < diff.length; i++) {
        let rowData = table.row(diff[i].node).data();
        reorderedData.push({
            id: rowData.id,  // Use the unique ID for each row (assuming 'ordering' is the ID)
            new_position: diff[i].newPosition + 1  // The new position starts from 1
        });
    }

    // Loop through all rows in the table to capture rows that were not reordered
      table.rows().every(function (rowIdx) {
          let rowData = this.data();
          let isReordered = diff.some(d => d.node === this.node());
          if (!isReordered) {
              reorderedData.push({
                  id: rowData.id,
                  new_position: rowIdx + 1
              });
          }
      });

      $.ajax({
          url: baseUrl + "/api/updateCourseOrder",
          type: "PATCH",
          headers: { "Accept": "application/json" },
          data: JSON.stringify(reorderedData),
          contentType: "application/json",
          success: function(response) {
           //   console.log('Order updated successfully:', response);
              table.ajax.reload();  // Reload table if needed
          },
          error: function(error) {
              console.error('Error updating order:', error);
          }
      });
  }
});

table.on('draw', function () {
    if ($('[data-bs-toggle="tooltip"]') !== undefined) {
        $('[data-bs-toggle="tooltip"]').tooltip();
    }
});

var validator;
jQuery.validator.addMethod("extension", function (value, element, param) {
    return this.optional(element) || value.match(new RegExp("\\.(" + param + ")$", "i"));
}, "Please enter a file with a valid mp4, avi, mov, wmv");


jQuery.validator.addMethod("extensionDesktop", function (value, element, param) {
    return this.optional(element) || value.match(new RegExp("\\.(" + param + ")$", "i"));
}, "Please enter a file with a valid JPG,JPEG SVG image with a resolution of 1920x982 pixels");

jQuery.validator.addMethod("extensionMobile", function (value, element, param) {
    return this.optional(element) || value.match(new RegExp("\\.(" + param + ")$", "i"));
}, "Please enter a file with a valid JPG,JPEG SVG image with a resolution of 720x1280 pixels");

var isImageDesktopValid = true;
var isImageMobileValid = true;

$.validator.addMethod("imageSizeDesktop", function (value, element, param) {
    if (element.files.length === 0) {
        return true; // No file uploaded, allow submission
    }

    var file = element.files[0];
    var fileType = file.name.split('.').pop().toLowerCase(); // Get file extension

    var allowedFormats = ["jpg", "jpeg","svg"];

    if (!allowedFormats.includes(fileType)) {
       // $("#mediaPreview").attr("src", 'https://placehold.co/512x512').show();
        isImageDesktopValid = false;
        return false; // Invalid file type
    }

    var img = new Image();
    var objectURL = URL.createObjectURL(file);
    img.src = objectURL;

    img.onload = function () {
        if (img.width === param[0] && img.height === param[1]) {
           // $("#mediaPreview").attr("src", objectURL).show(); // Show preview
            isImageDesktopValid = true;
        } else {
            // $("#mediaPreview").hide(); // Hide preview if invalid
            // $("#mediaPreview").attr("src", 'https://placehold.co/512x512').show();
            isImageDesktopValid = false;
        }

        $(element).valid(); // Trigger revalidation
    };

    return isImageDesktopValid;
}, "course banner desktop must be a JPG,JPEG, SVG image with a resolution of 1920x982 pixels.");


$.validator.addMethod("imageSizeMobile", function (value, element, param) {
    if (element.files.length === 0) {
        return true; // No file uploaded, allow submission
    }

    var file = element.files[0];
    var fileType = file.name.split('.').pop().toLowerCase(); // Get file extension

    var allowedFormats = ["jpg", "jpeg","svg"];

    if (!allowedFormats.includes(fileType)) {
       // $("#mediaPreview").attr("src", 'https://placehold.co/720x1280').show();
       isImageMobileValid = false;
        return false; // Invalid file type
    }

    var img = new Image();
    var objectURL = URL.createObjectURL(file);
    img.src = objectURL;

    img.onload = function () {
        if (img.width === param[0] && img.height === param[1]) {
           // $("#mediaPreview").attr("src", objectURL).show(); // Show preview
           isImageMobileValid = true;
        } else {
            // $("#mediaPreview").hide(); // Hide preview if invalid
            // $("#mediaPreview").attr("src", 'https://placehold.co/720x1280').show();
            isImageMobileValid = false;
        }

        $(element).valid(); // Trigger revalidation
    };

    return isImageMobileValid;
}, "course banner mobile must be a JPG,JPEG, SVG image with a resolution of 720x1280 pixels.");

// Initialize jQuery Validation
$(document).ready(function () {
    // Initialize jQuery Validation
     validator = $("#data_form").validate({
        rules: {
            name: {
                required: true,
                minlength: 3,
            },
            short_description: {
                required: true,
                minlength: 10,
            },
            master_id: {
                required: true,
            },
            instructor: {
                required: true,
            },
            course_cost: {
                required: true,
            },
            type: {
                required: true,
            },
            no_of_modules: {
                required: true,
            },
            category: {
                required: true,
            },
            trailor_video: {
                required: function () {
                    return $("#course_id").val() === ""; // Validate only if course_id is blank
                },
                extension: "mp4|avi|mov|wmv",
                //maxFileSize: 10485760, // 10 MB limit
            },
            course_banner_desktop: {
                required: function () {
                    return $("#course_id").val() === ""; // Validate only if course_id is blank
                },
                extensionDesktop: "jpg|jpeg|svg",
                imageSizeDesktop: [1920, 982]
            },
            course_banner_mobile: {
                required: function () {
                    return $("#course_id").val() === ""; // Validate only if course_id is blank
                },
                extensionMobile: "jpg|jpeg|svg",
                imageSizeMobile: [720, 1280]
            },
            learnings:{
                required: true,
            },
            duration:{
                required: true,
            }
        },
        messages: {
            name: {
                required: "Please enter the course name.",
            },
            short_description: {
                required: "Please enter the short description.",
            },
            master_id: {
                required: "Please select master.",
            },
            instructor: {
                required: "Please enter the instructor name.",
            },
            course_cost: {
                required: "Please enter the course cost.",
            },
            type: {
                required: "Please select course type.",
            },
            no_of_modules: {
                required: "Please enter the no of modules.",
            },
            category: {
                required: "Please select category.",
            },
            trailor_video: {
                required: "Please upload a trailor video.",
                extension: "Only MP4, AVI, MOV, or WMV files are allowed for trailor video.",
            },
            course_banner_desktop: {
                required: "Please upload a course banner of 1920X982.",
            },
            course_banner_mobile: {
                required: "Please upload a course banner of 720X1280.",
            },
            learnings: {
                required: "Please enter what you will get to learn?",
            },
            duration: {
                required: "Please enter entire duration of course?",
            },
        },
        errorPlacement: function (error, element) {
            error.insertAfter(element); // Append error below file input
        },
        submitHandler: function (form) {
            if (!isImageDesktopValid) {
                validator.element("#course_banner_desktop");
                return false; // Prevent form submission
            }

            if (!isImageMobileValid) {
                validator.element("#course_banner_mobile");
                return false; // Prevent form submission
            }

            // Call the submitForm function
            submitForm(form);
        }
    });

    // Attach change event handlers after validator is initialized
    $("#course_banner_desktop").on("change", function () {
        console.log("validator>>",validator)
        validator.element(this); // Revalidate the file input
    });

    $("#course_banner_mobile").on("change", function () {
        validator.element(this); // Revalidate the file input
    });

    function submitForm(form) {
        var formData = new FormData(form);
        var url = $("#course_id").val() == '' ? baseUrl + "/api/add_course" : baseUrl + "/api/edit_course";

        $.ajax({
            url: url,
            method: "POST",
            data: formData,
            processData: false,
            contentType: false,
            beforeSend: function (xhr) {
                $(".indicator-progress").show();
                $("#form_save_button").attr('disabled', true);
            },
            success: function (response) {
                $(".indicator-progress").hide();
                if (response.status) {
                    success_message(response.message);
                    setTimeout(function () {
                        window.location = "/admin/course-list";
                    }, 2000); // 2 seconds delay
                } else {
                    if (response.err && response.err != '')
                        fail_message(response.err);
                    else
                        fail_message(response.message);
                }
                $("#form_save_button").attr('disabled', false);
            },
            error: function (response) {
                $(".indicator-progress").hide();
                $("#form_save_button").attr('disabled', false);

                $(".error-message").remove();

                if (response.responseJSON && response.responseJSON.errors && response.responseJSON.errors.errors) {
                    response.responseJSON.errors.errors.forEach(function (error) {
                        // Select the input field based on the `path` in the error
                        const field = $(`[name="${error.path}"]`);
                        if (field.length) {
                            // Append error message next to the field
                            field.after(`<div class="error-message text-danger">${error.msg}</div>`);
                        }
                    });
                }
            }
        });
    }

    $("form#addEditForm").on("submit", function (e) {
        e.preventDefault();

        // Trigger jQuery Validation
        if (!validator.form()) {
            return false; // Prevent form submission if validation fails
        }
    });
});

$("form#data_form").on("submit", function (e) {
e.preventDefault();

// Trigger jQuery Validation
if (!validator.form()) {
    return false; // Prevent form submission if validation fails
}
});

$("#course_topic_button").click(function(){
        var formData = new FormData($("#topic_data_form")[0]);
        if ($("#topic_id").val() == '') {
            url =baseUrl + "/api/add_course_topic";
        }
        else {
            url=baseUrl + "/api/update_topic";
        }
        $.ajax({
            url: url,
            method: "POST",
            data: formData,
            processData: false,
            contentType: false,
            beforeSend: function (xhr) {
                $(".indicator-progress").show()
                $("#course_topic_button").attr('disabled', true);
            },
            success: function (response) {
                $(".indicator-progress").hide()
                $(".error-message").remove();
                if (response.status) {
                    success_message(response.message);
                    $("#topic").val('')
                    $("#topic_id").val('')
                    $("input[name='topic_video']").val('');
                    $("#description").val('');
                    $("#video_duration").val('');
                    $(".topic_video_view_div").addClass('d-none');
                    $('#topic_data_table').DataTable().ajax.reload();
                } else {
                    fail_message(response.message);
                }
                $("#course_topic_button").attr('disabled', false);
            },
            error: function (response) {
                $(".indicator-progress").hide()
                $("#course_topic_button").attr('disabled', false);

                $(".error-message").remove();

                if (response.responseJSON && response.responseJSON.errors && response.responseJSON.errors.errors) {
                    response.responseJSON.errors.errors.forEach(function (error) {
                    // Select the input field based on the `path` in the error
                    const field = $(`[name="${error.path}"]`);
                    if (field.length) {
                        // Append error message next to the field
                        field.after(`<div class="error-message text-danger">${error.msg}</div>`);
                    }
                    });
                }
            }
        });
});

$('#topic_video').on('change', function () {
    const file = this.files[0];

    if (file) {
      const video = document.createElement('video');
      video.preload = 'metadata';

      video.onloadedmetadata = function () {
        window.URL.revokeObjectURL(video.src); // Release object URL

        const duration = video.duration; // Get duration in seconds

        // Convert duration to hours, minutes, and seconds
        const hours = Math.floor(duration / 3600);
        const minutes = Math.floor((duration % 3600) / 60);
        const seconds = Math.floor(duration % 60);

        // Format the result as HH:MM:SS
        const formattedDuration = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        $('#video_duration').val(formattedDuration);
      };

      video.src = URL.createObjectURL(file);
    }
  });


function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}

function edit_data(id) {
    window.location="/admin/course/"+id;
}

function delete_data(id) {
    Swal.fire({
        // text: "Are you sure you want to delete ?",
        // icon: "warning",
        // showCancelButton: true,
        // buttonsStyling: false,
        // confirmButtonText: "Yes, delete!",
        // cancelButtonText: "No, cancel",
        // customClass: {
        //     confirmButton: "btn fw-bold btn-danger",
        //     cancelButton: "btn fw-bold btn-active-light-primary"
        // }

        icon: "warning",
        text: "Are you sure you want to delete ?",
        imageWidth: 48,
        imageHeight: 48,
        showCloseButton: true,
        showCancelButton: true,
        cancelButtonText: "Cancel",
        confirmButtonText: "Yes, Delete it!",
        cancelButtonColor: "#d33",
        confirmButtonColor: "#3085d6",
        width: 320,
        allowOutsideClick: false,
    }).then(function (result) {
        if (result.value) {

            var data = {
                course_id: id
            }
            $.ajax({
                url: '/api/final_delete_course',
                method: "POST",
                data: data,
                DataTypes: "JSON",
                beforeSend: function (xhr) {


                },
                success: function (response) {
                    $(".indicator-progress").hide()
                    if (response.status) {

                        success_message(response.message);
                        $('#data_table').DataTable().ajax.reload();
                    } else {
                        fail_message(response.message);
                    }

                },
                error: function (response) {
                    fail_message(response.message);

                }
            });

            //});
        } else if (result.dismiss === 'cancel') {
            Swal.fire({
                text: customerName + " was not deleted.",
                icon: "error",
                buttonsStyling: false,
                confirmButtonText: "Ok, got it!",
                customClass: {
                    confirmButton: "btn fw-bold btn-primary",
                }
            });
        }
    });
}

function edit_topic_data(id) {
    var actionUrl = baseUrl + '/api/get_particular_course_topic';

    $.ajax({
        url: actionUrl,
        method: "POST",
        data: {topic_id:id},
        dataType: "json",
        beforeSend: function () { },
        success: function (response) {

            if (response.status) {
                $("#topic_id").val(response.data.id);
                $("#topic").val(response.data.topic);
                $("#description").val(response.data.description);
                $("#video_duration").val(response.data.video_duration);
                $(".topic_video_view_div").removeClass('d-none');
                var topic_video=response.data.topic_video;
                if (topic_video) {
                    topic_video = topic_video.replace(/public\\/, "");
                    topic_video = topic_video.replace(/\\/g, "/");
                }
                $("#topic_video_view").attr('href',topic_video);
            } else {
                fail_message(response.message);
            }
        },
        error: function (response) {

            fail_message(response.message);
        }
    });
}

function delete_topic_data(id) {
    console.log(id)
    Swal.fire({
        text: "Are you sure you want to delete topic?",
        icon: "warning",
        showCancelButton: true,
        buttonsStyling: false,
        confirmButtonText: "Yes, delete!",
        cancelButtonText: "No, cancel",
        customClass: {
            confirmButton: "btn fw-bold btn-danger",
            cancelButton: "btn fw-bold btn-active-light-primary"
        }
    }).then(function (result) {
        if (result.value) {

            var data = {
                topic_id: id
            }
            $.ajax({
                url: '/api/final_delete_course_topic',
                method: "POST",
                data: data,
                DataTypes: "JSON",
                beforeSend: function (xhr) {


                },
                success: function (response) {
                    $(".indicator-progress").hide()
                    if (response.status) {

                        success_message(response.message);
                        $('#topic_data_table').DataTable().ajax.reload();
                    } else {
                        fail_message(response.message);
                    }

                },
                error: function (response) {
                    fail_message(response.message);

                }
            });

            //});
        } else if (result.dismiss === 'cancel') {
            Swal.fire({
                text: customerName + " was not deleted.",
                icon: "error",
                buttonsStyling: false,
                confirmButtonText: "Ok, got it!",
                customClass: {
                    confirmButton: "btn fw-bold btn-primary",
                }
            });
        }
    });
}


var topictable = $("#topic_data_table").DataTable({
    "searching": true,
    "ordering": false,
    "rowReorder": {
          selector: 'td:not(.no-reorder)',  // Makes the entire row draggable
            update: false    // Prevents auto-updating; we'll handle it manually
        },
    "aLengthMenu": [
        [10, 15, 25, 50, 100, -1],
        [10, 15, 25, 50, 100, "All"]
    ],
    "language": {
        "lengthMenu": "Show _MENU_",
    },
    "dom": "<'row mb-2'" +
        "<'col-sm-6 d-flex align-items-center justify-conten-start dt-toolbar'l>" +
        "<'col-sm-6 d-flex align-items-center justify-content-end dt-toolbar'f>" +
        ">" +
        "<'table-responsive'tr>" +
        "<'row'" +
        "<'col-sm-12 col-md-5 d-flex align-items-center justify-content-center justify-content-md-start'i>" +
        "<'col-sm-12 col-md-7 d-flex align-items-center justify-content-center justify-content-md-end'p>" +
        ">",
    "buttons": [{
        extend: 'excel',
        text: 'EXCEL',
        title: "Craft school - course topic",
        filename: 'course_' + new Date().getTime(),
        exportOptions: {
            columns: ':not(:gt(-3))' // Exclude the last 2 columns (Actions)
        }
    },
    {
        extend: 'csv',
        text: 'CSV',
        title: "Craft school - course topic",
        filename: 'course_' + new Date().getTime(),
        exportOptions: {
            columns: ':not(:gt(-3))' // Exclude the last 2 columns (Actions)
        }
    },
    {
        extend: 'pdfHtml5',
        text: 'PDF',
        title: "Craft school - course topic",
        filename: 'course_' + new Date().getTime(),
        exportOptions: {
            columns: ':not(:gt(-3))' // Exclude the last 2 columns (Actions)
        }
    },
    ],
    "processing": true,
    "serverSide": true,
    "serverMethod": "post",
    "ajax": {
        "url": "/api/getCourseTopics",
        "accept": "application/json",
        "data": function (d) {
            d.course_id = $("#topic_page_course_id").val(); // Replace with your key-value pair
        },
        "beforeSend": function (xhr) {

        },
    },

    "columns": [{ data:"id", className: "text-center fs-6", visible:false},
        {
        data: "ordering",
        className:"text-center"
    },{
        data: "course_name"
    },
    {
        data: "topic"
    },
    {
        data: "description"
    },
    {
        data: "topic_video",
        className:"no-reorder",
    },
    {
        data: "video_duration"
    },
    {
        data: "free_video",
        className:"text-center"
    },
    {
        data: "status",
         className:"no-reorder"
    },

    // {
    //     data: "created_by"
    // },

    {
        data: "updated_by"
    },

    {
        data: "action",
        searchable: false,
        orderable: false,
        className: "w-150px no-reorder",
    }
    ]
});

topictable.on('row-reorder', function (e, diff, edit) {
    if (diff.length) {
      let reorderedData = [];

      // Loop through the reordered rows (from 'diff')
      for (let i = 0; i < diff.length; i++) {
        let rowData = topictable.row(diff[i].node).data();
        reorderedData.push({
            id: rowData.id,  // Use the unique ID for each row (assuming 'ordering' is the ID)
            new_position: diff[i].newPosition + 1  // The new position starts from 1
        });
    }

    // Loop through all rows in the table to capture rows that were not reordered
    topictable.rows().every(function (rowIdx) {
          let rowData = this.data();
          let isReordered = diff.some(d => d.node === this.node());
          if (!isReordered) {
              reorderedData.push({
                  id: rowData.id,
                  new_position: rowIdx + 1
              });
          }
      });

      $.ajax({
          url: baseUrl + "/api/updateCourseTopicOrder",
          type: "PATCH",
          headers: { "Accept": "application/json" },
          data: JSON.stringify(reorderedData),
          contentType: "application/json",
          success: function(response) {
           //   console.log('Order updated successfully:', response);
           topictable.ajax.reload();  // Reload table if needed
          },
          error: function(error) {
              console.error('Error updating order:', error);
          }
      });
  }
});

topictable.on('draw', function () {
    if ($('[data-bs-toggle="tooltip"]') !== undefined) {
        $('[data-bs-toggle="tooltip"]').tooltip();
    }
});


function change_status(id, status) {
    var actionUrl = baseUrl + '/api/course_change_status';

    $.ajax({
        url: actionUrl,
        method: "POST",
        data: {course_id:id, status: status },
        dataType: "json",
        beforeSend: function () { },
        success: function (response) {

            if (response.status) {
                success_message(response.message);
                table.ajax.reload();
            } else {
                fail_message(response.message);
            }
        },
        error: function (response) {

            fail_message(response.message);
        }
    });
}

function trending_change_status(id, status) {
    var actionUrl = baseUrl + '/api/course_trending_change_status';

    $.ajax({
        url: actionUrl,
        method: "POST",
        data: {course_id:id, status: status },
        dataType: "json",
        beforeSend: function () { },
        success: function (response) {

            if (response.status) {
                toastr.success(response.message);
                //success_message(response.message);
                table.ajax.reload();
            } else {
                //fail_message(response.message);
                toastr.error(response.message);
            }
        },
        error: function (response) {

            fail_message(response.message);
        }
    });
}


function change_topic_status(id, status) {
    var actionUrl = baseUrl + '/api/change_topic_status';

    $.ajax({
        url: actionUrl,
        method: "POST",
        data: {topic_id:id, status: status },
        dataType: "json",
        beforeSend: function () { },
        success: function (response) {

            if (response.status) {
                success_message(response.message);
                $('#topic_data_table').DataTable().ajax.reload();
            } else {
                fail_message(response.message);
            }
        },
        error: function (response) {

            fail_message(response.message);
        }
    });
}

$("#filter").click(function(){
    $("#data_table").DataTable().ajax.reload();
  });

$("#filter_collapse").click(function(){
    $(".filter_card").toggleClass("hidden");
  });

$("#clear").click(function(){
    $('#category').val('').trigger('change')
    $('#master').val('').trigger('change')
    $('#status').val('').trigger('change')
    $("#data_table").DataTable().ajax.reload();
})

var start = moment().startOf("month").format("DD-MM-YYYY")
var end = moment().endOf("month").format("DD-MM-YYYY")

function cb(start, end) {
    $("#range_date").html(start.format("DD-MM-YYYY") + " - " + end.format("DD-MM-YYYY"));
}

$("#range_date").daterangepicker({
    locale: {
                format: "DD-MM-YYYY"
            },
    startDate: start,
    endDate: end,
    ranges: {
    "Today": [moment(), moment()],
    "Yesterday": [moment().subtract(1, "days"), moment().subtract(1, "days")],
    "Last 7 Days": [moment().subtract(6, "days"), moment()],
    "Last 30 Days": [moment().subtract(29, "days"), moment()],
    "This Month": [moment().startOf("month"), moment().endOf("month")],
    "Last Month": [moment().subtract(1, "month").startOf("month"), moment().subtract(1, "month").endOf("month")]
    }
}, cb);

cb(start, end);


