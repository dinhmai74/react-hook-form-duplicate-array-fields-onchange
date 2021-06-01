// import { yupResolver } from '@hookform/resolvers/yup'
import { toNestError } from '@hookform/resolvers'
import { forEach, get, isEmpty } from 'lodash'
import React, { useCallback, useMemo, useState } from 'react'
import { appendErrors, Controller, useFieldArray, useForm } from 'react-hook-form'
import * as yup from 'yup'
import './form.css'

const findDuplicates = (arr, name) => {
  let sorted_arr = arr.slice().sort((v) => v[name]) // You can define the comparing function here.
  // JS by default uses a crappy string compare.
  // (we use slice to clone the array so the
  // original array won't be modified)
  let results = []
  let counts = {}
  for (let i = 0; i < sorted_arr.length - 1; i++) {
    const current = sorted_arr[i]
    const next = sorted_arr[i + 1]
    if (current[name] === next[name]) {
      if (!counts[name]) {
        counts[name] = true
        results.push(current)
      }
      results.push(next)
    }
  }
  return results
}

yup.addMethod(yup.object, 'notDuplicate', function (propertyName, message = 'Duplicated') {
  return this.test('unique', message, function (value) {
    const duplicateResult = findDuplicates(this.parent, propertyName)
    const errors = []

    if (duplicateResult?.length > 0) {
      duplicateResult.forEach((duplicate) => {
        const { parentName, index } = duplicate
        const path = `${parentName}.${index}.${propertyName}`
        // const path = `${this.path}.${propertyName}`
        errors.push(
          this.createError({
            path,
            message,
          }),
        )
      })
    }

    if (!isEmpty(errors)) {
      throw new yup.ValidationError(errors)
    }

    return true
  })
})
/**
 * Why `path!` ? because it could be `undefined` in some case
 * https://github.com/jquense/yup#validationerrorerrors-string--arraystring-value-any-path-string
 */
const parseErrorSchema = (error, validateAllFieldCriteria) => {
  return error.inner.reduce((previous, error) => {
    if (error?.path && !previous[error?.path]) {
      previous[error?.path] = { message: error.message, type: error?.type }
    }

    if (validateAllFieldCriteria) {
      const types = previous[error?.path].types
      const messages = types && types[error?.type]

      previous[error?.path] = appendErrors(
        error?.path,
        validateAllFieldCriteria,
        previous,
        error?.type,
        messages ? [].concat(messages, error.message) : error.message,
      )
    }

    return previous
  }, {})
}
const useYupValidationResolver = (validationSchema) => {
  return useCallback(
    async (data, context, options) => {
      const { setErrors } = context
      try {
        data = forEach(data, (fields, name) => {
          forEach(fields, (value, index) => {
            value.index = index
            value.parentName = name
          })
        })

        const values = await validationSchema.validate(data, {
          abortEarly: false,
        })

        setErrors({})
        return {
          values,
          errors: {},
        }
      } catch (errors) {
        const finalErrors = toNestError(parseErrorSchema(errors, true), options.fields)
        setErrors(finalErrors)
        return {
          values: {},
          errors: finalErrors,
        }
      }
    },
    [validationSchema],
  )
}

const formSchema = {
  firstName: yup.string().required('form.required_message'),
}

export function Form() {
  const validationSchema = useMemo(
    () =>
      yup.object().shape({
        test: yup.array().of(yup.object().shape(formSchema).notDuplicate('firstName')),
      }),
    [],
  )
  const [errors, setErrors] = useState({})
  const resolver = useYupValidationResolver(validationSchema)
  const { register, formState, control, handleSubmit } = useForm({
    // defaultValues: {}; you can populate the fields by this attribute
    // resolver: yupResolver(fieldsSchema, { abortEarly: false }, { mode: 'async' }),
    mode: 'onChange',
    reValidateMode: 'onChange',
    criteriaMode: 'all',
    resolver,
    shouldUnregister: true,
    context: {
      setErrors,
    },
  })

  const { isDirty, isSubmitting } = formState

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'test',
    shouldUnregister: true,
  })

  const handleAppend = () => {
    append(
      { firstName: null },
      {
        shouldFocus: true,
      },
    )
  }

  const isSubmitBtnDisabled = !isEmpty(errors) || !isDirty || isSubmitting

  return (
    <form onSubmit={handleSubmit((data) => console.log(data))}>
      <ul>
        {fields.map((item, index) => (
          <li key={item.id}>
            <div>
              <Controller
                render={({ field: { ...rest } }) => <input {...rest} />}
                name={`test.${index}.firstName`}
                control={control}
                defaultValue={item.firstName} // make sure to set up defaultValue
              />

              {get(errors, `test.${index}.firstName.message`) && (
                <p className="text-xs">{get(errors, `test.${index}.firstName.message`)}</p>
              )}
            </div>

            <button type="button" onClick={() => remove(index)}>
              Delete
            </button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={handleAppend}>
        append
      </button>
      <input type="submit" disabled={isSubmitBtnDisabled} />
      <br />
      {JSON.stringify(formState?.isValid)}
    </form>
  )
}
