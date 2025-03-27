
var input1 = document.querySelector("#blog_tags");

if (input1 != undefined) {
    var tagify = new Tagify(input1);

    tagify.on("change", (e) => {
        console.log("Tags:", tagify.value); // Outputs an array of tag objects
    });
}

if (document.querySelector('#blog_desc') != undefined) {
    ClassicEditor.create(document.querySelector('#blog_desc'))
        .then(editor => {
            console.log(editor);
        })
        .catch(error => {
            console.error(error);
        });
}

if (document.getElementById('blogs_table') != undefined) {
    var table = $("#blogs_table").DataTable({
        "searching": true,
        "ordering": false,
        "aLengthMenu": [
            [10, 15, 25, 50, 100, -1],
            [10, 15, 25, 50, 100, "All"]
        ],
        "language": { "lengthMenu": "Show _MENU_" },
        "dom": "<'row mb-2'" +
            "<'col-sm-6 d-flex align-items-center justify-content-start dt-toolbar'l>" +
            "<'col-sm-6 d-flex align-items-center justify-content-end dt-toolbar'f>" +
            ">" +
            "<'table-responsive'tr>" +
            "<'row'" +
            "<'col-sm-12 col-md-5 d-flex align-items-center justify-content-center justify-content-md-start'i>" +
            "<'col-sm-12 col-md-7 d-flex align-items-center justify-content-center justify-content-md-end'p>" +
            ">",
        "processing": true,
        "serverSide": true,
        "ajax": {
            "url": baseUrl + "/api/getBlogs",
            "type": "POST",
            "headers": {
                "Accept": "application/json"
            },
            "data": function (d) {
                let formData = $("#filterForm").serializeArray().reduce((obj, item) => {
                    obj[item.name] = item.value;
                    return obj;
                }, {});

                return Object.assign(d, formData); // Merge filter values into DataTables request
            },
            "dataSrc": function (json) {
                return json.data;
            }
        },
        "columns": [
            { data: "title", className: "text-center fs-6" },
            { data: "featured_media", className: "text-center fs-6" },
            { data: "cat_name", className: "text-center fs-6" },
            { data: "master_name", className: "text-center fs-6" },
            { data: "status" ,visible:isActionVisible},
            //{ data: "created_by", className: "text-center fs-6" },
            { data: "updated_by", className: "text-center fs-6" },

            {
                data: "action",
                orderable: false,
                searchable: false,
                className: "text-end",
                visible:isActionVisible
            }
        ]
    });

    table.on('draw', function () {
        if ($('[data-bs-toggle="tooltip"]') !== undefined) {
            $('[data-bs-toggle="tooltip"]').tooltip();
        }
    });
}

var isImageValid = true;

$.validator.addMethod("imageSize", function (value, element, param) {
    if (element.files.length === 0) {
        return true; // No file uploaded, allow submission
    }

    var file = element.files[0];
    var fileType = file.name.split('.').pop().toLowerCase(); // Get file extension

    var allowedFormats = ["jpg", "jpeg", "png", "svg"];

    if (!allowedFormats.includes(fileType)) {
        $("#mediaPreview").attr("src", 'https://placehold.co/600x400').show();
        isImageValid = false;
        return false; // Invalid file type
    }

    var img = new Image();
    var objectURL = URL.createObjectURL(file);
    img.src = objectURL;

    img.onload = function () {
        if (img.width === param[0] && img.height === param[1]) {
            $("#mediaPreview").attr("src", objectURL).show(); // Show preview
            isImageValid = true;
        } else {
            $("#mediaPreview").hide(); // Hide preview if invalid
            $("#mediaPreview").attr("src", 'https://placehold.co/600x400').show();
            isImageValid = false;
        }

        $(element).valid(); // Trigger revalidation
    };

    return isImageValid;
}, "Featured Media must be a JPG, JPEG, PNG, or SVG image with a resolution of 600x400 pixels.");

// Initialize jQuery Validation
var validator = $("#addEditForm").validate({
    rules: {
        featured_media: {
            required: function () {
                return $("#blog_id").val() === ""; // Required only in "add" mode
            },
            imageSize: [600, 400] // Custom validation rule (handles both size & format)
        }
    },
    messages: {
        featured_media: {
            required: "Please upload a featured media."
        }
    },
    errorPlacement: function (error, element) {
        error.insertAfter(element); // Append error below file input
    },
    submitHandler: function (form) {
        if (!isImageValid) {
            validator.element("#featured_media"); // Ensure error message shows
            return false; // Prevent form submission
        }

        // Call the submitForm function
        submitForm(form);
    }
});

$("#featured_media").on("change", function () {
    validator.element(this); // Revalidate the file input
});

function submitForm(form) {
    var formData = new FormData(form);
    const tags = tagify.value.map(tag => tag.value).join(",");
    formData.delete("tags");
    formData.append('tags', tags);

    const id = $("[name='blog_id']").val();
    var actionUrl = id ? '/api/blog/' + id : '/api/blog';
    var method = id ? "PATCH" : "POST";

    $.ajax({
        url: baseUrl + actionUrl,
        method: method,
        data: formData,
        contentType: false,
        processData: false,
        headers: {
            Accept: 'application/json',
        },
        beforeSend: function () {
            $(form).find('span.error-text').text('');
            $(form).find('button[type="submit"]').prop('disabled', true);
        },
        success: function (response) {
            toastr.remove();
            if (response.status) {
                success_message(response.message);
                setTimeout(() => {
                    location.href = '/admin/blogs';
                }, 1200);
            } else {
                fail_message(response.message);
            }
            $(form).find('button[type="submit"]').prop('disabled', false);
        },
        error: function (response) {
            $(form).find('button[type="submit"]').prop('disabled', false);
            toastr.remove();
            if (response.responseJSON.errors) {
                Object.entries(response.responseJSON.errors).forEach(([fieldName, errorMsg]) => {
                    const field = $(`[name="${fieldName}"]`);
                    if (field.length) {
                        $(form).find('span.' + fieldName + '-error').text(errorMsg);
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


function delete_data(id) {
    swal.fire({
       // title: 'Delete',
       icon: "warning",
        text: 'Are You Sure ?',
        imageWidth: 48,
        imageHeight: 48,
        showCloseButton: true,
        showCancelButton: true,
        cancelButtonText: 'Cancel',
        confirmButtonText: 'Yes, Delete it!',
        cancelButtonColor: '#d33',
        confirmButtonColor: '#3085d6',
        width: 320,
        allowOutsideClick: false,
    }).then(function (result) {
        if (result.value) {
            var actionUrl = baseUrl + '/api/blog/' + id;
            var method = "DELETE";
            $.ajax({
                url: actionUrl,
                method: method,
                dataType: "json",
                beforeSend: function () { },
                success: function (response) {
                    toastr.remove();
                    if (response.status) {
                        //toastr.success(response.message);
                        success_message(response.message);
                        table.ajax.reload();
                    } else {
                        //toastr.error(response.message);
                        fail_message(response.message);
                    }
                },
                error: function (response) {
                    toastr.remove();
                    toastr.error(response.message);
                }
            });
        }
    });
}

function change_status(id, status) {
    var actionUrl = baseUrl + '/api/blog/' + id + '/changeStatus/' + status;
    var method = "PATCH";
    $.ajax({
        url: actionUrl,
        method: method,
        data: { status: status },
        dataType: "json",
        beforeSend: function () { },
        success: function (response) {
            toastr.remove();
            if (response.status) {
                toastr.success(response.message);
                table.ajax.reload();
            } else {
               // toastr.error(response.message);
               fail_message(response.message);
            }
        },
        error: function (response) {
            toastr.remove();
            toastr.error(response.message);
        }
    });
}

$("#filter").click(function(){
    $("#blogs_table").DataTable().ajax.reload();
  });

$("#filter_collapse").click(function(){
    $(".filter_card").toggleClass("hidden");
  });

$("#clear").click(function(){
    $('#category').val('').trigger('change')
    $('#master').val('').trigger('change')
    $('#status').val('').trigger('change')
    $("#blogs_table").DataTable().ajax.reload();
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
