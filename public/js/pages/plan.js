


$("#form_save_button").click(function () {

    var formData = new FormData($("#data_form")[0]);
    if ($("#plan_id").val() == '') {
        url = baseUrl + "/api/add_plan";
    }
    else {
        url = baseUrl + "/api/update_plan";
    }
    $.ajax({
        url: url,
        method: "POST",
        data: formData,
        processData: false,
        contentType: false,
        beforeSend: function (xhr) {
            $(".indicator-progress").show()
            $("#form_save_button").attr('disabled', true);
        },
        success: function (response) {
            $(".indicator-progress").hide()
            if (response.status) {
                success_message(response.message);
                setTimeout(function () {
                    window.location = "/admin/plans-list";
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
            $(".indicator-progress").hide()
            $("#form_save_button").attr('disabled', false);

            $(".error-message").remove();

            if (response.responseJSON && response.responseJSON.errors && response.responseJSON.errors.errors) {
                response.responseJSON.errors.errors.forEach(function (error) {
                    // Handle fields with brackets like courses[] and supported_devices[]
                    let fieldName = error.path.replace(/\[\]/g, '');

                    // Select the input field based on the sanitized field name
                    const field = $(`[name="${error.path}"], [name="${fieldName}[]"]`);

                    if (field.length) {
                        // Append error message after the last field in the group for checkboxes or multi-selects
                        if (field.is(':checkbox')) {
                            field.last().parent().parent().append(`<div class="error-message text-danger">${error.msg}</div>`);
                        }
                        else if(field.is('select[multiple]'))
                        {
                            field.parent().append(`<div class="error-message text-danger">${error.msg}</div>`);
                        }
                        else {
                            field.after(`<div class="error-message text-danger">${error.msg}</div>`);
                        }
                    }
                });
            }

        }
    });

});


function edit_data(id) {

    window.location = baseUrl + '/admin/plan/' + id
}

function delete_data(id) {
    swal
        .fire({
            //title: "Delete",
            icon: "warning",
            text: "Are You Sure ?",
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
        })
        .then(function (result) {
            if (result.value) {
                var actionUrl = baseUrl + "/api/plan_delete/";
                var data = {
                    id: id
                }
                $.ajax({
                    url: actionUrl,
                    method: "POST",
                    dataType: "json",
                    data: data,
                    beforeSend: function () { },
                    success: function (response) {
                        toastr.remove();
                        if (response.status) {
                            // toastr.success(response.message);
                            success_message(response.message);
                            setTimeout(function () {
                                location.reload();
                            }, 2000);
                        } else {
                            //toastr.error(response.message);
                            fail_message(response.message);
                        }
                    },
                    error: function (response) {
                        toastr.remove();
                        toastr.error(response.message);
                    },
                });
            }
        });
}


function plan_change_status(id, status,checkbox) {
    var originalState = checkbox.checked;
    var actionUrl = baseUrl + '/api/plan_change_status';

    //
    Swal.fire({
        icon: "warning",
        text: "Are you sure you want to change plan status ?",
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

            $.ajax({
                url: actionUrl,
                method: "POST",
                data: { id: id, status: status },
                dataType: "json",
                beforeSend: function () { },
                success: function (response) {

                    if (response.status) {
                        success_message(response.message);
                        setTimeout(function () {
                            location.reload();
                        }, 2000);
                    } else {
                        fail_message(response.message);
                    }
                },
                error: function (response) {

                    fail_message(response.message);
                    checkbox.checked = !originalState
                }
            });

            //});
        }else{
            checkbox.checked = !originalState
        }
    });

    //

}


function change_publish_status(id, publish) {
    //
    var actionUrl = baseUrl + '/api/change_publish_status';

    //
    Swal.fire({

        icon: "warning",
        text: "Are you sure you want to change publish status ?",
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

            $.ajax({
                url: actionUrl,
                method: "POST",
                data: { id: id, publish: publish },
                dataType: "json",
                beforeSend: function () { },
                success: function (response) {

                    if (response.status) {
                        success_message(response.message);

                        setTimeout(function () {
                            location.reload();
                        }, 2000);

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

        }
    });
}


document.getElementById('courses').addEventListener('change', function (event) {
    const allOption = this.querySelector('option[value="All"]');
    const selectedOptions = Array.from(this.selectedOptions).map(option => option.value);

    if (event.target.value === "All" && event.target.selected) {
        // Deselect all other options when "All" is selected
        Array.from(this.options).forEach(option => {
            if (option.value !== "All") {
                option.selected = false;
            }
        });
    } else if (selectedOptions.includes("All")) {
        // Deselect "All" if any other option is selected
        allOption.selected = false;
    }
});
