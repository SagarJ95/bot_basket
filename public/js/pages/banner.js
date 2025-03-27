
var table;
if (document.getElementById('banners_table') != undefined) {
    function initializeTable(bannerType = '') {

        //tab active bannerType wise
        var tab = document.querySelector('.nav-tabs'); // Select the tabs container
        var tablinks = tab.getElementsByTagName('a');

        for (var i = 0; i < tablinks.length; i++) {
            tablinks[i].classList.remove('active'); // Remove active class
            if (tablinks[i].getAttribute('data-value') == bannerType) {
                tablinks[i].classList.add('active'); // Add active class
            }
        }

        let tableId = `#banners_table`;
        if ($.fn.DataTable.isDataTable(tableId)) {
            $(tableId).DataTable().clear().destroy();
        }
         table = $('#banners_table').DataTable({
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
                "url": baseUrl + "/api/getBanners",
                "type": "POST",
                "headers": {
                    "Accept": "application/json"
                },
                "data": function (d) {
                    d.bannerType = bannerType; // Pass bannerType to API
                },
                "dataSrc": function (json) {
                    return json.data;
                }
            },
            "columns": [
                { data: "banner_image", className: "text-center fs-6" },
                { data: "mobile_banner_image", className: "text-center fs-6" },
                { data: "master", className: "text-center fs-6" },
                { data: "course", className: "text-center fs-6" },
                { data: "tag", className: "text-center fs-6" },
                // { data: "status",visible:isActionVisible },
                { data: "publish_banner",visible:isActionVisible },
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

    // Initialize table for the selected tab
    initializeTable(1)

    $('.nav-tabs').on('click', '.nav-link', function () {
        let bannerType = $(this).attr('data-value');
        // Initialize table for the selected tab
        initializeTable(bannerType);
    });

}

function change_status(id, status,bannerType,checkbox) {
    var originalState = checkbox.checked;

    var actionUrl = baseUrl + '/api/banner/' + id + '/changeStatus/' + status;
    var method = "PATCH";
    $.ajax({
        url: actionUrl,
        method: method,
        data: { status: status },
        dataType: "json",
        headers: {
            Accept: 'application/json',
        },
        beforeSend: function () { },
        success: function (response) {
            toastr.remove();
            if (response.status) {
                toastr.success(response.message);
                //table.ajax.reload();
                initializeTable(bannerType)
            } else {

                toastr.error(response.message);
            }
        },
        error: function (response) {
            toastr.error(response.responseJSON.message);
            checkbox.checked = !originalState
        }
    });
}

function change_publish_status(id, status,bannerType,checkbox) {
    var originalState = checkbox.checked;
    let displayMsg = (status == 1) ? `Are You Sure To Publish The Banner ?` : `Are You Sure To UnPublish The Banner ?`;
    swal.fire({
        icon: "warning",
        text: displayMsg,
        imageWidth: 48,
        imageHeight: 48,
        showCloseButton: true,
        showCancelButton: true,
        cancelButtonText: 'Cancel',
        confirmButtonText: 'Yes, Do it!',
        cancelButtonColor: '#d33',
        confirmButtonColor: '#3085d6',
        width: 320,
        allowOutsideClick: false,
    }).then(function (result) {
        if (result.value) {
            var actionUrl = baseUrl + '/api/banner/' + id + '/changePublishStatus/' + status + '/' + bannerType;
            var method = "PATCH";
            $.ajax({
                url: actionUrl,
                method: method,
                data: { status: status,bannerType:bannerType },
                dataType: "json",
                headers: {
                    Accept: 'application/json',
                },
                beforeSend: function () { },
                success: function (response) {
                    toastr.remove();
                    if (response.status) {
                        toastr.success(response.message);
                        //table.ajax.reload();
                        initializeTable(bannerType)
                    } else {
                        toastr.error(response.message);
                    }
                },
                error: function (response) {
                    toastr.remove();
                    toastr.error(response.responseJSON.message);
                }
            });
        }else{
            checkbox.checked = !originalState
        }
    });
}


$("form#addEditForm").on("submit", function (e) {
    e.preventDefault();

    var form = $(this);
    var formData = new FormData(form[0]);
    const id = $("[name='banner_id']").val();

    var actionUrl = id ? '/api/banner/' + id : '/api/banner';
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
            form.find('span.error').text('');
            form.find('button[type="submit"]').prop('disabled', true);
        },
        success: function (response) {
            toastr.remove();
            if (response.status) {
               // toastr.success(response.message);
               success_message(response.message);
                setTimeout(() => {
                    location.href = '/admin/banners';
                }, 1200);
            } else {
                //toastr.error(response.message);
                fail_message(response.message);
            }
            form.find('button[type="submit"]').prop('disabled', false);
        },
        error: function (response) {
            form.find('button[type="submit"]').prop('disabled', false);
            toastr.remove();
            // toastr.error(response.responseJSON.message);
            if (response.responseJSON.errors) {
                // Loop through object keys and values
                Object.entries(response.responseJSON.errors).forEach(([fieldName, errorMsg]) => {
                    const field = $(`[name="${fieldName}"]`);
                    if (field.length) {
                        form.find('span.' + fieldName + '-error').text(errorMsg);
                    }
                });
            }

            if(response.responseJSON.message){
                form.find('span.course-error').text(response.responseJSON.message);
            }

        }
    });
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
            var actionUrl = baseUrl + '/api/banner/' + id;
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
                   // toastr.error(response.message);
                   fail_message(response.message);
                }
            });
        }
    });
}

if (document.getElementById('banner_image') != undefined) {
    document.getElementById('banner_image').addEventListener('change', function (event) {
        const file = event.target.files[0];
        const errorMessage = document.querySelector('.banner_image-error');
        const preview = document.getElementById('mediaPreview');

        // Clear previous error messages and preview
        errorMessage.textContent = '';
        preview.src = '';

        if (!file) {
            return;
        }

        // Check file size (2MB = 2 * 1024 * 1024 bytes)
        if (file.size > 2 * 1024 * 1024) {
            errorMessage.textContent = 'File size must not exceed 2MB.';
            return;
        }

        const img = new Image();
        img.onload = function () {
            // Validate dimensions
            if (img.width > 1920 || img.height > 982) {
                errorMessage.textContent = 'Image dimensions must not exceed 1920px width and 982px height.';
                return;
            }

            // Set the preview image
            preview.src = URL.createObjectURL(file);
        };

        img.onerror = function () {
            errorMessage.textContent = 'The selected file is not a valid image.';
        };

        // Read the file to load the image
        img.src = URL.createObjectURL(file);
    });
}

if (document.getElementById('mobile_banner_image') != undefined) {
    document.getElementById('mobile_banner_image').addEventListener('change', function (event) {
        const file = event.target.files[0];
        const errorMessage = document.querySelector('.mobile_banner_image-error');
        const preview = document.getElementById('MobilemediaPreview');

        // Clear previous error messages and preview
        errorMessage.textContent = '';
        preview.src = '';

        if (!file) {
            return;
        }

        // Check file size (2MB = 2 * 1024 * 1024 bytes)
        if (file.size > 2 * 1024 * 1024) {
            errorMessage.textContent = 'File size must not exceed 2MB.';
            return;
        }

        const img = new Image();
        img.onload = function () {
            // Validate dimensions
            if (img.width > 720 || img.height > 1280) {
                errorMessage.textContent = 'Image dimensions must not exceed 720px width and 1280px height.';
                return;
            }

            // Set the preview image
            preview.src = URL.createObjectURL(file);
        };

        img.onerror = function () {
            errorMessage.textContent = 'The selected file is not a valid image.';
        };

        // Read the file to load the image
        img.src = URL.createObjectURL(file);
    });
}

$('#tag').on('change',function(){
    var tag = $(this).val();

    if(tag == 7){
        $('#courseLabel').removeClass('required'); // Removes required class
    } else {
        $('.fw-semibold.mb-2.mt-2').addClass('required'); // Ensure
    }
})
